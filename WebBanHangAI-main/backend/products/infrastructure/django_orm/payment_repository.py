from __future__ import annotations

import json

from django.utils import timezone

from products.application.customer_context import get_customer_for_user
from products.domain.common.exceptions import NotFoundError
from products.models import Order, Payment, PaymentWebhookLog


class DjangoOrmPaymentRepository:
    def create_payment(self, user, payload):
        order = Order.objects.filter(order_id=payload.get('order_id'), user=get_customer_for_user(user)).first()
        if order is None:
            raise NotFoundError('Order not found')
        method = payload.get('method') or order.payment_method
        payment, _ = Payment.objects.get_or_create(
            order=order,
            defaults={'amount': order.final_amount, 'payment_method': method, 'status': 'pending'},
        )
        if method != 'cod' and order.payment_status == 'unpaid':
            order.payment_status = 'pending'
            order.save(update_fields=['payment_status', 'updated_at'])
        return {
            'payment_id': payment.payment_id,
            'status': payment.status,
            'amount': payment.amount,
            'method': payment.payment_method,
        }

    def handle_callback(self, provider: str, payload):
        order_id = payload.get('order_id')
        payment = Payment.objects.filter(order_id=order_id, payment_method=provider).first()
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

        success = bool(payload.get('success'))
        payment.status = 'success' if success else 'failed'
        payment.transaction_id = payload.get('transaction_id') or payment.transaction_id
        payment.paid_at = timezone.now() if success else payment.paid_at
        payment.save(update_fields=['status', 'transaction_id', 'paid_at'])

        payment.order.payment_status = 'paid' if success else 'failed'
        payment.order.save(update_fields=['payment_status', 'updated_at'])

        webhook.processed = True
        webhook.process_message = 'success' if success else 'failed'
        webhook.save(update_fields=['processed', 'process_message'])
