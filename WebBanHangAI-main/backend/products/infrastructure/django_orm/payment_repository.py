from __future__ import annotations

import json
from datetime import timedelta

from django.db import transaction
from django.db.models import Case, F, IntegerField, Value, When
from django.utils import timezone

from products.application.customer_context import get_customer_for_user
from products.application.orders.dto import CreateOrderDTO
from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.infrastructure.stored_procedures import cancel_order_and_restore_stock
from products.models import Cart, CartItem, Coupon, CouponUsage, Notification, Order, Payment, PaymentWebhookLog
from products.services.payos_service import cancel_payos_payment_link, create_payos_payment_link, get_payos_payment_status


class DjangoOrmPaymentRepository:
    def create_payment(self, user, payload):
        order = Order.objects.filter(order_id=payload.get('order_id'), user=get_customer_for_user(user)).first()
        if order is None:
            raise NotFoundError('Order not found')
        method = payload.get('method') or 'payos'
        if method != 'payos' or order.payment_method != 'payos':
            raise BusinessRuleViolation('Order is not configured for payOS')
        if order.payment_status == 'paid':
            raise BusinessRuleViolation('Order has already been paid')

        payment, _ = Payment.objects.get_or_create(
            order=order,
            defaults={'amount': order.final_amount, 'payment_method': method, 'status': 'pending'},
        )
        if payment.gateway_response:
            try:
                cached = json.loads(payment.gateway_response)
            except (TypeError, ValueError):
                cached = {}
            if cached.get('checkout_url'):
                return {
                    'payment_id': payment.payment_id,
                    'status': payment.status,
                    'amount': int(payment.amount),
                    'method': payment.payment_method,
                    **cached,
                }

        link = create_payos_payment_link(order_id=order.order_id, amount=int(order.final_amount))
        payment.amount = order.final_amount
        payment.payment_method = 'payos'
        payment.transaction_id = link['payment_link_id']
        expires_at = link.get('expires_at') or timezone.now() + timedelta(minutes=15)
        payment.gateway_response = json.dumps(
            {
                **link,
                'expires_at': expires_at.isoformat(),
            },
            ensure_ascii=False,
        )
        payment.status = 'pending'
        payment.expires_at = expires_at
        payment.save(
            update_fields=[
                'amount',
                'payment_method',
                'transaction_id',
                'gateway_response',
                'status',
                'expires_at',
                'updated_at',
            ]
        )
        order.payment_expires_at = expires_at
        if order.payment_status != 'pending':
            order.payment_status = 'pending'
        order.save(update_fields=['payment_status', 'payment_expires_at', 'updated_at'])
        return {
            'payment_id': payment.payment_id,
            'status': payment.status,
            'amount': int(payment.amount),
            'method': payment.payment_method,
            **link,
        }

    def handle_callback(self, provider: str, payload):
        order_id = payload.get('order_id')
        payment = Payment.objects.select_related('order').filter(order_id=order_id, payment_method=provider).first()
        webhook = PaymentWebhookLog.objects.create(
            payment=payment,
            provider=provider,
            transaction_code=payload.get('transaction_id'),
            payload=json.dumps(payload.get('raw_payload') or {}, ensure_ascii=False),
        )
        if payment is None:
            webhook.process_message = 'Payment not found'
            webhook.save(update_fields=['process_message'])
            raise NotFoundError('Payment not found')

        if not payload.get('success'):
            webhook.process_message = 'payOS did not report a successful payment'
            webhook.save(update_fields=['process_message'])
            raise BusinessRuleViolation('Payment was not successful')

        if int(payload.get('amount') or 0) != int(payment.amount):
            webhook.process_message = 'Payment amount mismatch'
            webhook.save(update_fields=['process_message'])
            raise BusinessRuleViolation('Payment amount mismatch')

        was_paid = payment.status == 'success' and payment.order.payment_status == 'paid'
        self._mark_payment_paid(payment, payload.get('transaction_id'))
        webhook.processed = True
        webhook.process_message = 'duplicate' if was_paid else 'success'
        webhook.save(update_fields=['processed', 'process_message'])

    def get_payment_status(self, user, order_id: int):
        order = Order.objects.filter(order_id=order_id, user=get_customer_for_user(user)).first()
        if order is None:
            raise NotFoundError('Order not found')
        payment = order.payments.order_by('-created_at').first()

        payos_status = None
        if (
            payment is not None
            and payment.payment_method == 'payos'
            and order.status != 'cancelled'
            and order.payment_status != 'paid'
        ):
            payos_status = get_payos_payment_status(payment.transaction_id or order.order_id)
            if int(payos_status['order_code']) != int(order.order_id):
                raise BusinessRuleViolation('payOS order code mismatch')

            expected_amount = int(payment.amount)
            if payos_status['status'] == 'PAID':
                if (
                    int(payos_status['amount']) != expected_amount
                    or int(payos_status['amount_paid']) != expected_amount
                ):
                    raise BusinessRuleViolation('payOS payment amount mismatch')
                self._mark_payment_paid(
                    payment,
                    payos_status.get('transaction_id') or payos_status.get('payment_link_id'),
                )
                order.refresh_from_db(fields=['payment_status', 'updated_at'])
                payment.refresh_from_db(fields=['status', 'transaction_id', 'paid_at'])
            elif self._is_expired(order, payment):
                self._expire_order(order, payment)
                order.refresh_from_db()
                payment.refresh_from_db()

        cached = self._gateway_data(payment)
        checkout_url = cached.get('checkout_url')
        if payos_status and payos_status['status'] not in {'PENDING', 'PROCESSING'}:
            checkout_url = None
        return {
            'order_id': order.order_id,
            'order_status': order.status,
            'payment_status': order.payment_status,
            'payment_method': order.payment_method,
            'payment_id': payment.payment_id if payment else None,
            'status': payment.status if payment else None,
            'amount': int(payment.amount if payment else order.final_amount),
            'provider_status': payos_status['status'] if payos_status else None,
            'checkout_url': checkout_url,
            'expires_at': self._expiration(order, payment).isoformat() if payment else None,
            'can_switch_to_cod': bool(
                payment
                and order.status == 'pending'
                and order.payment_method == 'payos'
                and order.payment_status == 'pending'
                and not self._is_expired(order, payment)
            ),
            'can_reorder_cod': order.status == 'cancelled',
        }

    def switch_to_cod(self, user, order_id: int):
        customer = get_customer_for_user(user)
        order = Order.objects.filter(order_id=order_id, user=customer).first()
        if order is None:
            raise NotFoundError('Order not found')
        payment = order.payments.order_by('-created_at').first()
        if payment is None or order.payment_method != 'payos':
            raise BusinessRuleViolation('Order is not awaiting payOS payment')

        provider = get_payos_payment_status(payment.transaction_id or order.order_id)
        if provider['status'] == 'PAID':
            if int(provider['amount_paid']) != int(payment.amount):
                raise BusinessRuleViolation('payOS payment amount mismatch')
            self._mark_payment_paid(payment, provider.get('transaction_id') or provider.get('payment_link_id'))
            raise BusinessRuleViolation('Order has already been paid')
        if self._is_expired(order, payment):
            self._expire_order(order, payment)
            raise BusinessRuleViolation('Payment time expired; order was cancelled')

        if provider['status'] not in {'CANCELLED', 'EXPIRED', 'FAILED'}:
            cancel_payos_payment_link(payment.transaction_id or order.order_id, 'Customer switched to COD')
        with transaction.atomic():
            locked_order = Order.objects.select_for_update().get(order_id=order.order_id)
            locked_payment = Payment.objects.select_for_update().get(payment_id=payment.payment_id)
            locked_order.payment_method = 'cod'
            locked_order.payment_status = 'unpaid'
            locked_order.payment_expires_at = None
            locked_order.save(update_fields=['payment_method', 'payment_status', 'payment_expires_at', 'updated_at'])
            locked_payment.payment_method = 'cod'
            locked_payment.status = 'pending'
            locked_payment.failure_reason = 'payOS cancelled because customer switched to COD'
            locked_payment.expires_at = None
            locked_payment.save(update_fields=['payment_method', 'status', 'failure_reason', 'expires_at', 'updated_at'])
        return self.get_payment_status(user, order_id)

    def reorder_as_cod(self, user, order_id: int):
        from products.infrastructure.django_orm.order_repository import DjangoOrmOrderRepository

        customer = get_customer_for_user(user)
        old_order = (
            Order.objects.filter(order_id=order_id, user=customer, status='cancelled')
            .prefetch_related('items__variant', 'items__product')
            .first()
        )
        if old_order is None:
            raise NotFoundError('Cancelled order not found')

        cart = Cart.objects.create(customer=customer)
        generated_ids = []
        try:
            for item in old_order.items.all():
                variant = item.variant
                if not variant.is_active or variant.product.status != 'active':
                    raise BusinessRuleViolation(f'{item.product_name_snapshot} is no longer available')
                if variant.stock_quantity - variant.stock_reserved < item.quantity:
                    raise BusinessRuleViolation(f'{item.product_name_snapshot} does not have enough stock')
                cart_item = CartItem.objects.create(cart=cart, variant=variant, quantity=item.quantity)
                generated_ids.append(cart_item.cart_item_id)

            dto = CreateOrderDTO(
                payment_method='cod',
                cart_item_ids=generated_ids,
                address_id=old_order.address_id,
                receiver_name=old_order.receiver_name_snapshot,
                receiver_phone=old_order.receiver_phone_snapshot,
                coupon_code=old_order.coupon.code if old_order.coupon_id else None,
            )
            with transaction.atomic():
                return DjangoOrmOrderRepository().create_customer_order(user, customer, dto)
        except Exception:
            CartItem.objects.filter(cart_item_id__in=generated_ids).delete()
            Cart.objects.filter(cart_id=cart.cart_id, items__isnull=True).delete()
            raise

    @staticmethod
    def _mark_payment_paid(payment: Payment, transaction_id=None):
        with transaction.atomic():
            locked_payment = Payment.objects.select_for_update().select_related('order').get(
                payment_id=payment.payment_id
            )
            if locked_payment.status == 'success' and locked_payment.order.payment_status == 'paid':
                return
            locked_payment.status = 'success'
            locked_payment.transaction_id = transaction_id or locked_payment.transaction_id
            locked_payment.paid_at = timezone.now()
            locked_payment.save(update_fields=['status', 'transaction_id', 'paid_at'])
            locked_payment.order.payment_status = 'paid'
            locked_payment.order.save(update_fields=['payment_status', 'updated_at'])
            Notification.objects.create(
                user=locked_payment.order.user.user,
                title='Thanh toán thành công',
                content=f'Đơn hàng #{locked_payment.order_id} đã được thanh toán thành công.',
                notification_type='payment',
            )

    @staticmethod
    def _gateway_data(payment):
        if payment is None or not payment.gateway_response:
            return {}
        try:
            return json.loads(payment.gateway_response)
        except (TypeError, ValueError):
            return {}

    @staticmethod
    def _expiration(order, payment):
        return order.payment_expires_at or payment.expires_at or order.created_at + timedelta(minutes=15)

    def _is_expired(self, order, payment):
        return self._expiration(order, payment) <= timezone.now()

    def _expire_order(self, order, payment):
        if order.status == 'cancelled':
            return
        provider = get_payos_payment_status(payment.transaction_id or order.order_id)
        if provider['status'] == 'PAID':
            self._mark_payment_paid(payment, provider.get('transaction_id') or provider.get('payment_link_id'))
            return
        if provider['status'] not in {'CANCELLED', 'EXPIRED', 'FAILED'}:
            cancel_payos_payment_link(payment.transaction_id or order.order_id, 'Payment expired after 15 minutes')
        cancel_order_and_restore_stock(order.order_id, None, 'payOS payment expired after 15 minutes')
        Payment.objects.filter(payment_id=payment.payment_id).update(
            status='failed',
            failure_reason='Payment expired after 15 minutes',
        )
        Order.objects.filter(order_id=order.order_id).update(payment_status='failed')
        usage_deleted, _ = CouponUsage.objects.filter(order_id=order.order_id).delete()
        if usage_deleted and order.coupon_id:
            Coupon.objects.filter(coupon_id=order.coupon_id).update(
                used_count=Case(
                    When(used_count__gt=0, then=F('used_count') - 1),
                    default=Value(0),
                    output_field=IntegerField(),
                )
            )

    def expire_pending_orders(self):
        payments = Payment.objects.select_related('order').filter(
            payment_method='payos',
            status='pending',
            order__status='pending',
            order__payment_status='pending',
        )
        expired = 0
        for payment in payments:
            if self._is_expired(payment.order, payment):
                self._expire_order(payment.order, payment)
                expired += 1
        return expired
