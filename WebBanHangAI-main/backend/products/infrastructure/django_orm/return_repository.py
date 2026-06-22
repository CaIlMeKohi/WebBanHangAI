from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from products.domain.common.exceptions import BusinessRuleViolation
from products.models import Order, ReturnRequest, ReturnRequestImage


class DjangoOrmReturnRepository:
    def list_customer_returns(self, customer):
        return ReturnRequest.objects.filter(user=customer).order_by('-created_at')

    def create_return_request(self, customer, payload):
        order = Order.objects.filter(order_id=payload.get('order_id'), user=customer, status='delivered').first()
        if order is None:
            raise BusinessRuleViolation('Chi duoc doi tra don delivered cua chinh minh')
        if order.updated_at < timezone.now() - timedelta(days=7):
            raise BusinessRuleViolation('Da qua thoi han doi tra 7 ngay')
        reason = str(payload.get('reason', '')).strip()
        images = payload.get('images') or []
        if not reason:
            raise BusinessRuleViolation('Bat buoc nhap ly do')
        if not images:
            raise BusinessRuleViolation('Bat buoc co it nhat 1 anh minh chung')
        item = ReturnRequest.objects.create(
            user=customer,
            order=order,
            order_item_id=payload.get('order_item_id'),
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
