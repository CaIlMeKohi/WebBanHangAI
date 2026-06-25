from __future__ import annotations

import json

from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from django.db.models import Avg, Count

from products.models import AuditLog, OrderItem, Product, Review, ReviewImage, UserInteraction
from products.services.cloudinary_service import delete_cloudinary_image, upload_review_image_asset


class DjangoOrmReviewRepository:
    def create_review(self, customer, payload):
        order_item = self._resolve_reviewable_order_item(customer, payload)
        if order_item is None:
            raise BusinessRuleViolation('Chi duoc danh gia san pham da mua trong don da giao hoac hoan thanh')
        if Review.objects.filter(user=customer, order_item=order_item).exists():
            raise BusinessRuleViolation('Lan mua nay da duoc danh gia')
        rating = int(payload.get('rating', 0))
        if rating < 1 or rating > 5:
            raise BusinessRuleViolation('Rating phai tu 1 den 5')
        image_assets = self._upload_review_images(payload.get('images') or [])
        image_urls = [asset['secure_url'] for asset in image_assets]
        review = Review.objects.create(
            user=customer,
            product=order_item.product,
            order_item=order_item,
            rating=rating,
            comment=payload.get('comment', ''),
            status='approved',
            image_urls=json.dumps(image_urls, ensure_ascii=False),
        )
        self._create_review_images(review, image_assets)
        self._refresh_product_rating(order_item.product_id)
        UserInteraction.objects.create(user=customer, product=order_item.product, interaction_type='review', score=rating)
        return review.review_id

    def _create_review_images(self, review: Review, image_assets: list[dict]) -> None:
        ReviewImage.objects.bulk_create(
            [
                ReviewImage(
                    review=review,
                    image_url=asset['secure_url'],
                    cloudinary_public_id=asset.get('public_id') or '',
                    display_order=index,
                )
                for index, asset in enumerate(image_assets)
            ]
        )

    def _upload_review_images(self, images) -> list[dict]:
        image_assets = []
        for image in list(images)[:5]:
            try:
                image_assets.append(upload_review_image_asset(image))
            except RuntimeError as exc:
                raise BusinessRuleViolation(str(exc)) from exc
        return image_assets

    def _resolve_reviewable_order_item(self, customer, payload):
        queryset = OrderItem.objects.select_related('order', 'product').filter(
            order__user=customer,
            order__status__in=['delivered', 'completed'],
        )
        order_item_id = payload.get('order_item_id')
        if order_item_id:
            return queryset.filter(order_item_id=order_item_id).first()
        product_id = payload.get('product_id')
        if product_id:
            reviewed_order_items = Review.objects.filter(user=customer).values('order_item_id')
            return (
                queryset.filter(product_id=product_id)
                .exclude(order_item_id__in=reviewed_order_items)
                .order_by('-order__created_at')
                .first()
            )
        return None

    def _refresh_product_rating(self, product_id: int) -> None:
        stats = Review.objects.filter(product_id=product_id, status='approved').aggregate(
            average=Avg('rating'),
            total=Count('review_id'),
        )
        Product.objects.filter(product_id=product_id).update(
            average_rating=stats['average'] or 0,
            review_count=stats['total'] or 0,
        )

    def list_product_reviews(self, product_id: int):
        reviews = (
            Review.objects.filter(product_id=product_id, status='approved')
            .select_related('user')
            .prefetch_related('images')
            .order_by('-created_at')
        )
        return [
            {
                'review_id': item.review_id,
                'user_id': item.user_id,
                'rating': item.rating,
                'comment': item.comment,
                'image_urls': self._review_image_urls(item),
                'created_at': item.created_at,
            }
            for item in reviews
        ]

    def list_staff_reviews(self, status: str | None = None):
        reviews = Review.objects.select_related('product', 'user').prefetch_related('images').order_by('-created_at')
        if status:
            reviews = reviews.filter(status=status)
        return [
            {
                'review_id': item.review_id,
                'product_id': item.product_id,
                'product_name': item.product.name,
                'customer_id': item.user_id,
                'rating': item.rating,
                'comment': item.comment,
                'image_urls': self._review_image_urls(item),
                'status': item.status,
                'hidden_reason': item.hidden_reason,
                'created_at': item.created_at,
            }
            for item in reviews[:200]
        ]

    def moderate_review(self, staff, review_id: int, action: str, reason: str = '') -> None:
        review = Review.objects.filter(review_id=review_id).first()
        if review is None:
            raise NotFoundError('Review not found')
        if action not in {'approve', 'hide'}:
            raise BusinessRuleViolation('Action phai la approve hoac hide')
        if action == 'hide' and not reason:
            raise BusinessRuleViolation('An danh gia bat buoc ghi ly do')
        review.status = 'approved' if action == 'approve' else 'hidden'
        review.hidden_reason = reason if action == 'hide' else ''
        review.moderated_by_staff = staff
        review.save(update_fields=['status', 'hidden_reason', 'moderated_by_staff', 'updated_at'])
        self._refresh_product_rating(review.product_id)

    def delete_review(self, actor, review_id: int) -> None:
        review = Review.objects.prefetch_related('images').filter(review_id=review_id).first()
        if review is None:
            raise NotFoundError('Review not found')
        product_id = review.product_id
        audit_metadata = {
            'product_id': product_id,
            'customer_id': review.user_id,
            'rating': review.rating,
            'comment': review.comment or '',
        }
        public_ids = [
            image.cloudinary_public_id
            for image in review.images.all()
            if image.cloudinary_public_id
        ]
        self._delete_review_cloudinary_images(public_ids)
        review.delete()
        AuditLog.objects.create(
            actor=actor,
            action='admin_delete_review',
            entity_type='review',
            entity_id=str(review_id),
            metadata=audit_metadata,
        )
        self._refresh_product_rating(product_id)

    def _delete_review_cloudinary_images(self, public_ids: list[str]) -> None:
        for public_id in public_ids:
            try:
                delete_cloudinary_image(public_id)
            except RuntimeError as exc:
                raise BusinessRuleViolation(str(exc)) from exc

    def _review_image_urls(self, review: Review) -> list[str]:
        image_urls = [
            image.image_url
            for image in sorted(review.images.all(), key=lambda item: item.display_order)
            if image.image_url
        ]
        return image_urls or self._parse_image_urls(review.image_urls)

    def _parse_image_urls(self, raw_value: str | None) -> list[str]:
        if not raw_value:
            return []
        try:
            value = json.loads(raw_value)
            if isinstance(value, list):
                return [str(item) for item in value if item]
        except (TypeError, ValueError):
            return []
        return []
