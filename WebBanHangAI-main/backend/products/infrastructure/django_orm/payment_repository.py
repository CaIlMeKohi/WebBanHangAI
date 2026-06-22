from __future__ import annotations

import json
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from products.application.customer_context import get_customer_for_user
from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.models import Notification, Order, Payment, PaymentWebhookLog


class DjangoOrmPaymentRepository:
    def get_payment_for_customer(self, order_id, customer):
        return Payment.objects.filter(order_id=order_id, order__user=customer).first()

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

    @transaction.atomic
    def handle_callback(self, provider: str, payload):
        order_id = payload.get('order_id')
        payment = (
            Payment.objects.select_for_update()
            .select_related('order', 'order__user', 'order__user__user')
            .filter(order_id=order_id, payment_method=provider)
            .first()
        )
        if payment is None:
            # Ghi log cảnh báo nhưng không crash — chỉ log nếu model cho phép payment=NULL
            try:
                PaymentWebhookLog.objects.create(
                    payment=None,
                    provider=provider,
                    transaction_code=payload.get('transaction_id'),
                    payload=json.dumps(payload.get('raw_payload') or {}, ensure_ascii=False),
                    process_message='payment_not_found',
                )
            except Exception:  # noqa: BLE001 — nếu field là NOT NULL thì bỏ qua
                pass
            raise NotFoundError('Payment not found')

        webhook = PaymentWebhookLog.objects.create(
            payment=payment,
            provider=provider,
            transaction_code=payload.get('transaction_id'),
            payload=json.dumps(payload.get('raw_payload') or {}, ensure_ascii=False),
        )

        success = bool(payload.get('success'))
        transaction_id = str(payload.get('transaction_id') or '').strip() or None
        raw_amount = payload.get('amount')
        if raw_amount not in (None, ''):
            try:
                callback_amount = Decimal(str(raw_amount))
            except InvalidOperation as exc:
                webhook.process_message = 'invalid_amount'
                webhook.save(update_fields=['process_message'])
                raise BusinessRuleViolation('Số tiền callback không hợp lệ') from exc
            if callback_amount != payment.amount:
                webhook.process_message = 'amount_mismatch'
                webhook.save(update_fields=['process_message'])
                raise BusinessRuleViolation('Số tiền callback không khớp đơn hàng')
        if success and not transaction_id:
            webhook.process_message = 'missing_transaction_id'
            webhook.save(update_fields=['process_message'])
            raise BusinessRuleViolation('Callback thành công thiếu mã giao dịch')
        if transaction_id and Payment.objects.filter(transaction_id=transaction_id).exclude(payment_id=payment.payment_id).exists():
            webhook.process_message = 'duplicate_transaction_id'
            webhook.save(update_fields=['process_message'])
            raise BusinessRuleViolation('Mã giao dịch đã được sử dụng')
        if success and (payment.status == 'expired' or payment.order.status == 'cancelled'):
            webhook.processed = True
            webhook.process_message = 'late_success_ignored'
            webhook.save(update_fields=['processed', 'process_message'])
            return
        if payment.status == 'success':
            webhook.processed = True
            webhook.process_message = 'duplicate_ignored'
            webhook.save(update_fields=['processed', 'process_message'])
            return
        payment.status = 'success' if success else 'failed'
        payment.transaction_id = transaction_id or payment.transaction_id
        payment.gateway_response = json.dumps(payload.get('raw_payload') or {}, ensure_ascii=False)
        payment.failure_reason = None if success else str((payload.get('raw_payload') or {}).get('reason') or 'payment_failed')[:255]
        payment.paid_at = timezone.now() if success else payment.paid_at
        payment.save(update_fields=['status', 'transaction_id', 'gateway_response', 'failure_reason', 'paid_at', 'updated_at'])

        payment.order.payment_status = 'paid' if success else 'failed'
        payment.order.save(update_fields=['payment_status', 'updated_at'])
        Notification.objects.create(
            user=payment.order.user.user,
            title='Thanh toán thành công' if success else 'Thanh toán thất bại',
            content=(
                f'Đơn hàng #{payment.order_id} đã được thanh toán.'
                if success
                else f'Thanh toán cho đơn hàng #{payment.order_id} không thành công.'
            ),
            notification_type='payment',
        )

        webhook.processed = True
        webhook.process_message = 'success' if success else 'failed'
        webhook.save(update_fields=['processed', 'process_message'])
