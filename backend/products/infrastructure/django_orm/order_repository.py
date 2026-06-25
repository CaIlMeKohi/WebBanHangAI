from __future__ import annotations

import json

from django.db import DatabaseError, IntegrityError, models, transaction
from django.utils import timezone

from products.application.cart_service import get_customer_cart_items
from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.infrastructure.django_orm.coupon_repository import _calculate_discount
from products.infrastructure.stored_procedures import cancel_order_and_restore_stock, check_variant_stock, decrease_variant_stock, update_order_status
from products.models import Order
from products.models import Address, AuditLog, CartItem, Coupon, CouponUsage, Notification, OrderItem, OrderStatusHistory, Payment, RecommendationLog, ReturnRequest, ReturnRequestImage, Shipment, StaffProfile, UserInteraction
from products.services.cloudinary_service import upload_image
from products.services.email_service import send_order_confirmation


def _apply_order_filters(queryset, filters: dict):
    if filters.get('status'):
        queryset = queryset.filter(status=filters['status'])
    if filters.get('payment_method'):
        queryset = queryset.filter(payment_method=filters['payment_method'])
    if filters.get('from_date'):
        queryset = queryset.filter(created_at__date__gte=filters['from_date'])
    if filters.get('to_date'):
        queryset = queryset.filter(created_at__date__lte=filters['to_date'])
    return queryset


class DjangoOrmOrderRepository:
    def list_customer_orders(self, customer):
        return (
            Order.objects.filter(user=customer)
            .prefetch_related('items', 'items__reviews', 'items__product', 'items__product__images', 'items__product__variants')
            .order_by('-created_at')
        )

    def get_customer_order(self, customer, order_id: int):
        return (
            Order.objects.filter(order_id=order_id, user=customer)
            .prefetch_related('items', 'items__reviews', 'items__product', 'items__product__images', 'items__product__variants')
            .first()
        )

    def get_customer_order_detail(self, customer, order_id: int):
        return (
            Order.objects.filter(order_id=order_id, user=customer)
            .prefetch_related('items', 'items__reviews', 'status_histories')
            .first()
        )

    def list_staff_orders(self, filters: dict):
        queryset = (
            Order.objects.filter(status__in=[
                'pending_payment',
                'pending',
                'confirmed',
                'processing',
                'waiting_pickup',
                'shipped',
                'delivered',
                'completed',
                'cancelled',
            ])
            .select_related('user', 'user__user', 'address')
            .prefetch_related('items', 'items__reviews', 'items__product')
            .order_by('-created_at')
        )
        return _apply_order_filters(queryset, filters)[:200]

    def list_admin_orders(self, filters: dict):
        queryset = (
            Order.objects.select_related('user', 'user__user', 'address')
            .prefetch_related('items', 'items__reviews', 'items__product', 'status_histories')
            .order_by('-created_at')
        )
        return _apply_order_filters(queryset, filters)[:200]

    def get_admin_order_detail(self, order_id: int):
        return (
            Order.objects.filter(order_id=order_id)
            .select_related('user', 'user__user', 'address')
            .prefetch_related('items', 'items__reviews', 'items__product', 'status_histories')
            .first()
        )

    def create_customer_order(self, user, customer, payload):
        cart_queryset = get_customer_cart_items(customer)
        if payload.cart_item_ids:
            cart_queryset = cart_queryset.filter(cart_item_id__in=payload.cart_item_ids)
        cart_items = list(cart_queryset)
        if not cart_items:
            raise BusinessRuleViolation('Cart is empty')

        address = self._resolve_address(customer, payload.address_id)
        if address is None:
            raise BusinessRuleViolation('Vui long chon dia chi giao hang hop le truoc khi dat hang')

        receiver_name = str(payload.receiver_name or address.full_name).strip()
        receiver_phone = str(payload.receiver_phone or address.phone).strip()
        if not receiver_name:
            raise BusinessRuleViolation('Ten nguoi nhan bat buoc')
        if not receiver_phone.isdigit() or len(receiver_phone) < 9 or len(receiver_phone) > 20:
            raise BusinessRuleViolation('So dien thoai nguoi nhan khong hop le')

        for item in cart_items:
            if self._available_stock(item.product, item.variant) < item.quantity:
                raise BusinessRuleViolation(f'San pham {item.product.name} khong du ton kho')

        subtotal = sum(int(item.variant.price if item.variant_id else item.product.base_price) * item.quantity for item in cart_items)
        coupon, discount_amount = self._resolve_coupon(customer, payload.coupon_code, subtotal, cart_items)
        shipping_fee = 0 if subtotal > 1_000_000 else 30_000
        order = Order.objects.create(
            user=customer,
            address=address,
            order_code=f'ORD{timezone.now().strftime("%Y%m%d%H%M%S")}{customer.customer_id}',
            receiver_name_snapshot=receiver_name,
            receiver_phone_snapshot=receiver_phone,
            address_line_snapshot=address.address_line,
            ward_snapshot=address.ward,
            district_snapshot=address.district,
            province_snapshot=address.province,
            postal_code_snapshot=address.postal_code,
            total_amount=subtotal,
            shipping_fee=shipping_fee,
            discount_amount=discount_amount,
            coupon=coupon,
            final_amount=max(0, subtotal + shipping_fee - discount_amount),
            status='pending' if payload.payment_method == 'cod' else 'pending_payment',
            payment_method=payload.payment_method,
            payment_status='unpaid' if payload.payment_method == 'cod' else 'pending',
        )
        for item in cart_items:
            price = int(item.variant.price if item.variant_id else item.product.base_price)
            OrderItem.objects.create(
                order=order,
                product=item.product,
                variant=item.variant,
                product_name_snapshot=item.product.name,
                brand_name_snapshot=item.product.brand.name,
                category_name_snapshot=item.product.category.name,
                sku_snapshot=item.variant.sku,
                color_snapshot=item.variant.color,
                size_snapshot=item.variant.size,
                quantity=item.quantity,
                price=price,
                subtotal=price * item.quantity,
            )
            if item.variant_id and not decrease_variant_stock(item.variant.variant_id, item.quantity, order.order_id):
                transaction.set_rollback(True)
                raise BusinessRuleViolation(f'San pham {item.product.name} khong du ton kho')
            UserInteraction.objects.create(user=customer, product=item.product, interaction_type='purchase', score=5.0)
            RecommendationLog.objects.filter(
                user=customer,
                product=item.product,
                clicked=True,
                converted_order__isnull=True,
            ).update(ordered_after_click=True, converted_order=order)

        Payment.objects.create(order=order, amount=order.final_amount, payment_method=order.payment_method, status='pending')
        if coupon:
            CouponUsage.objects.create(user=customer, coupon=coupon, order=order, discount_amount=discount_amount)
            Coupon.objects.filter(coupon_id=coupon.coupon_id).update(used_count=models.F('used_count') + 1)
        CartItem.objects.filter(cart_item_id__in=[item.cart_item_id for item in cart_items], cart__customer=customer).delete()
        send_order_confirmation(user.email, order.order_id, order.final_amount)
        return order

    def cancel_customer_order(self, user, customer, order_id: int, payload):
        if user is None or customer is None:
            raise BusinessRuleViolation('Vui long dang nhap truoc khi huy don')
        order = Order.objects.filter(order_id=order_id, user=customer).first()
        if order is None:
            raise NotFoundError('Order not found')
        if order.status not in {'pending_payment', 'pending', 'confirmed', 'processing'}:
            raise BusinessRuleViolation('Khong the huy don o trang thai hien tai')
        images = list(payload.images or [])
        if not images:
            raise BusinessRuleViolation('Vui long gui it nhat 1 anh khi huy don')
        if ReturnRequest.objects.filter(
            order=order,
            desired_solution='cancel_order',
            status='pending',
        ).exists():
            raise BusinessRuleViolation('Yeu cau huy don dang cho nhan vien duyet')
        image_urls = []
        for image in images:
            try:
                image_urls.append(upload_image(image, 'fashion-shop/cancellations'))
            except RuntimeError as exc:
                raise BusinessRuleViolation(str(exc)) from exc
        try:
            with transaction.atomic():
                request_item = ReturnRequest.objects.create(
                    user=customer,
                    order=order,
                    reason=payload.reason,
                    desired_solution='cancel_order',
                    evidence_image_urls=json.dumps(image_urls, ensure_ascii=False),
                )
                ReturnRequestImage.objects.bulk_create([
                    ReturnRequestImage(return_request=request_item, image_url=image_url[:500])
                    for image_url in image_urls
                ])
                Notification.objects.create(
                    user=user,
                    title='Da gui yeu cau huy don',
                    content=f'Yeu cau huy don #{order.order_id} dang cho nhan vien duyet.',
                    notification_type='order_cancel',
                )
                AuditLog.objects.create(
                    actor=user,
                    action='request_order_cancellation',
                    entity_type='order',
                    entity_id=str(order.order_id),
                    metadata={'return_request_id': request_item.return_id, 'reason': payload.reason, 'image_count': len(image_urls)},
                )
        except (DatabaseError, IntegrityError) as exc:
            raise BusinessRuleViolation(f'Khong the gui yeu cau huy don: {exc}') from exc
        return order

    def confirm_customer_order_received(self, user, customer, order_id: int):
        order = Order.objects.filter(order_id=order_id, user=customer).first()
        if order is None:
            raise NotFoundError('Order not found')
        if order.status != 'delivered':
            raise BusinessRuleViolation('Chi co the xac nhan don hang da giao')

        old_status = order.status
        order.status = 'completed'
        order.updated_at = timezone.now()
        order.save(update_fields=['status', 'updated_at'])
        Shipment.objects.filter(order=order).update(
            shipment_status='completed',
            delivered_at=timezone.now(),
            updated_at=timezone.now(),
        )
        OrderStatusHistory.objects.create(
            order=order,
            from_status=old_status,
            to_status='completed',
            note='Khach hang xac nhan da nhan hang',
            changed_by=user,
        )
        Notification.objects.create(
            user=user,
            title='Don hang da hoan thanh',
            content=f'Don hang #{order.order_id} da duoc xac nhan nhan hang thanh cong.',
            notification_type='order',
        )
        AuditLog.objects.create(
            actor=user,
            action='customer_confirm_order_received',
            entity_type='order',
            entity_id=str(order.order_id),
            metadata={'from_status': old_status, 'to_status': 'completed'},
        )
        order.refresh_from_db()
        return order

    def update_order_status(self, actor, order_id: int, payload):
        transitions = {
            'pending': {'confirmed', 'cancelled'},
            'confirmed': {'processing', 'cancelled'},
            'processing': {'waiting_pickup', 'cancelled'},
            'waiting_pickup': {'shipped'},
            'shipped': {'delivered'},
            'delivered': {'completed'},
        }
        order = Order.objects.filter(order_id=order_id).first()
        if order is None:
            raise NotFoundError('Order not found')
        if payload.status not in transitions.get(order.status, set()):
            raise BusinessRuleViolation('Chuyen trang thai khong hop le')
        if payload.status == 'waiting_pickup' and not payload.carrier_name:
            raise BusinessRuleViolation('Can nhap don vi van chuyen khi giao hang')
        try:
            if payload.status == 'cancelled':
                cancel_order_and_restore_stock(order.order_id, actor.user_id if actor else None, payload.note or 'Staff cancelled order')
            else:
                update_order_status(
                    order.order_id,
                    payload.status,
                    actor.user_id if actor else None,
                    payload.carrier_name or None,
                    payload.tracking_code or None,
                    payload.note or None,
                )
        except DatabaseError as exc:
            raise BusinessRuleViolation('Khong the cap nhat trang thai don hang') from exc
        order.refresh_from_db()
        return order

    def _resolve_address(self, customer, address_id):
        if address_id:
            return Address.objects.filter(user=customer, address_id=address_id).first()
        return Address.objects.filter(user=customer, is_default=True).first()

    def _resolve_coupon(self, customer, raw_code, subtotal, cart_items):
        code = str(raw_code or '').strip().upper()
        if not code:
            return None, 0
        coupon = Coupon.objects.filter(code__iexact=code, is_active=True).first()
        if coupon is None:
            raise BusinessRuleViolation('Coupon khong hop le')
        discount = _calculate_discount(coupon, customer, subtotal, cart_items)
        return coupon, discount

    def _available_stock(self, product, variant=None):
        if variant is not None:
            stock = check_variant_stock(variant.variant_id, 1)
            if stock is not None and 'available_stock' in stock:
                return max(0, int(stock['available_stock']))
            return max(0, variant.stock_quantity - variant.stock_reserved)
        return sum(max(0, item.stock_quantity - item.stock_reserved) for item in product.variants.all())
