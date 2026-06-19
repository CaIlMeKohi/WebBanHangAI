from __future__ import annotations

from django.utils import timezone

from recommendations.services import get_for_you_recommendations, get_related_products
from products.domain.common.exceptions import NotFoundError
from products.infrastructure.stored_procedures import recommendation_performance, run_recommendation_batch
from products.models import Customer, PrecomputedRecommendation, Product, RecommendationLog


class DjangoOrmRecommendationRepository:
    def for_you(self, user_id: str | None, session_id: str | None, limit: int, search: str | None = None):
        return get_for_you_recommendations(user_id=user_id, session_id=session_id, limit=limit, search=search)

    def related_products(self, product_id: str, limit: int):
        return get_related_products(str(product_id), limit=limit)

    def log_for_you_impressions(self, user_id: str | None, session_id: str | None, products: list) -> None:
        customer = Customer.objects.filter(user_id=user_id, user__account_status='active').first() if user_id else None
        precomputed = {
            item.product_id: item
            for item in PrecomputedRecommendation.objects.filter(
                user=customer,
                product_id__in=[product.product_id for product in products],
            )
        } if customer else {}
        RecommendationLog.objects.bulk_create([
            RecommendationLog(
                user=customer,
                session_id=session_id,
                recommendation=precomputed.get(product.product_id),
                product=product,
            )
            for product in products
        ])

    def run_batch(self, top_n: int, cold_start_threshold: int):
        result = run_recommendation_batch(top_n=top_n, cold_start_threshold=cold_start_threshold)
        return {
            'generated': int(result.get('generated', 0)),
            'top_n': top_n,
            'cold_start_threshold': cold_start_threshold,
        }

    def metrics(self, from_date: str | None = None, to_date: str | None = None):
        return recommendation_performance(from_date=from_date, to_date=to_date)

    def record_event(self, user, product_id: int, event_type: str) -> None:
        product = Product.objects.filter(product_id=product_id, status='active').first()
        if product is None:
            raise NotFoundError('Product not found')
        customer = Customer.objects.filter(user=user).first()
        if event_type == 'click':
            item = RecommendationLog.objects.filter(user=customer, product=product, clicked=False).order_by('-shown_at').first()
            if item:
                item.clicked = True
                item.clicked_at = timezone.now()
                item.save(update_fields=['clicked', 'clicked_at'])
            else:
                RecommendationLog.objects.create(user=customer, product=product, clicked=True, clicked_at=timezone.now())
            return

        recommendation = (
            PrecomputedRecommendation.objects.filter(user=customer, product=product, expires_at__gt=timezone.now())
            .order_by('-generated_at')
            .first()
        )
        RecommendationLog.objects.create(user=customer, product=product, recommendation=recommendation)
