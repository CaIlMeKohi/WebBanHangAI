from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from products.domain.common.exceptions import BusinessRuleViolation
from products.models import Order, OrderItem, ReturnRequest, ReturnRequestImage


class DjangoOrmReturnRepository:
    def list_customer_returns(self, customer):
        return ReturnRequest.objects.filter(user=customer).order_by('-created_at')

    def create_return_request(self, customer, payload):
        order = (
            Order.objects.select_related('shipment')
            .filter(
                order_id=payload.get('order_id'),
                user=customer,
                status__in=['delivered', 'completed'],
            )
            .first()
        )
        if order is None:
            raise BusinessRuleViolation('Chỉ được đổi trả đơn đã giao của chính mình')
        delivered_at = getattr(getattr(order, 'shipment', None), 'delivered_at', None) or order.updated_at
        if delivered_at < timezone.now() - timedelta(days=7):
            raise BusinessRuleViolation('Da qua thoi han doi tra 7 ngay')
        order_item_id = payload.get('order_item_id')
        if not order_item_id or not OrderItem.objects.filter(
            order_item_id=order_item_id,
            order=order,
        ).exists():
            raise BusinessRuleViolation('Sản phẩm đổi trả không thuộc đơn hàng này')
        if ReturnRequest.objects.filter(
            user=customer,
            order=order,
            order_item_id=order_item_id,
            status__in=['pending', 'approved', 'completed'],
        ).exists():
            raise BusinessRuleViolation('Sản phẩm này đã có yêu cầu đổi trả')
        reason = str(payload.get('reason', '')).strip()
        images = payload.get('images') or []
        if not reason:
            raise BusinessRuleViolation('Bat buoc nhap ly do')
        if not images:
            raise BusinessRuleViolation('Bat buoc co it nhat 1 anh minh chung')
        item = ReturnRequest.objects.create(
            user=customer,
            order=order,
            order_item_id=order_item_id,
            reason=reason,
            desired_solution=payload.get('desired_solution', ''),
            evidence_image_urls=','.join(str(image_url)[:500] for image_url in images),
        )
        ReturnRequestImage.objects.bulk_create([
            ReturnRequestImage(return_request=item, image_url=str(image_url)[:500])
            for image_url in images
        ])
        return item

    def list_staff_returns(self):
        return ReturnRequest.objects.all().order_by('-created_at')
