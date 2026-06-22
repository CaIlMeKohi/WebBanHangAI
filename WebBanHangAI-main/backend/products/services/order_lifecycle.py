from __future__ import annotations

from django.db import DatabaseError, models, transaction
from django.utils import timezone

from products.infrastructure.stored_procedures import cancel_order_and_restore_stock
from products.models import (
    Coupon,
    CouponUsage,
    Notification,
    Order,
    OrderStatusHistory,
    Payment,
    ProductVariant,
    StockMovement,
)


def _staff_profile(actor):
    if getattr(actor, 'role', None) != 'staff':
        return None
    return getattr(actor, 'staff_profile', None)


def _restore_stock_with_orm(order: Order, actor, reason: str) -> None:
    for item in order.items.select_related('variant').all():
        variant = ProductVariant.objects.select_for_update().get(variant_id=item.variant_id)
        quantity_before = variant.stock_quantity
        variant.stock_quantity += item.quantity
        variant.save(update_fields=['stock_quantity', 'updated_at'])
        StockMovement.objects.create(
            variant=variant,
            order=order,
            staff=_staff_profile(actor),
            action_type='order_cancel',
            quantity_before=quantity_before,
            change_quantity=item.quantity,
            quantity_after=variant.stock_quantity,
            reason=reason[:255],
            note=f'Order item #{item.order_item_id}',
        )


def _release_coupon(order: Order) -> None:
    deleted_count, _ = CouponUsage.objects.filter(order=order).delete()
    if deleted_count and order.coupon_id:
        Coupon.objects.filter(
            coupon_id=order.coupon_id,
            used_count__gt=0,
        ).update(used_count=models.F('used_count') - 1)


def _mark_cancelled_payment(order: Order, payment_failure_status: str) -> None:
    payments = Payment.objects.filter(order=order)
    if order.payment_status == 'paid' or payments.filter(status='success').exists():
        order.payment_status = 'refund_pending'
        payments.filter(status='success').update(status='refund_pending')
        Notification.objects.create(
            user=order.user.user,
            title='Đang chờ hoàn tiền',
            content=f'Đơn hàng #{order.order_id} đã hủy. Khoản thanh toán đang chờ admin xác nhận hoàn tiền.',
            notification_type='payment',
        )
    else:
        order.payment_status = payment_failure_status
        payments.filter(status='pending').update(status=payment_failure_status)
    order.save(update_fields=['payment_status', 'updated_at'])


@transaction.atomic
def cancel_order_with_stock_restore(
    order: Order,
    *,
    actor=None,
    reason: str,
    payment_failure_status: str = 'failed',
) -> Order:
    locked_order = (
        Order.objects.select_for_update()
        .select_related('user', 'user__user')
        .get(order_id=order.order_id)
    )
    if locked_order.status == 'cancelled':
        return locked_order

    old_status = locked_order.status
    used_stored_procedure = False
    try:
        with transaction.atomic():
            cancel_order_and_restore_stock(
                locked_order.order_id,
                getattr(actor, 'user_id', None),
                reason,
            )
        used_stored_procedure = True
    except DatabaseError:
        _restore_stock_with_orm(locked_order, actor, reason)
        locked_order.status = 'cancelled'
        locked_order.save(update_fields=['status', 'updated_at'])

    locked_order.refresh_from_db()
    if used_stored_procedure and locked_order.status != 'cancelled':
        raise DatabaseError('Stored procedure did not cancel the order')

    if not used_stored_procedure:
        OrderStatusHistory.objects.create(
            order=locked_order,
            from_status=old_status,
            to_status='cancelled',
            note=reason[:500],
            changed_by=actor,
        )

    _release_coupon(locked_order)
    _mark_cancelled_payment(locked_order, payment_failure_status)
    locked_order.refresh_from_db()
    return locked_order


def expire_pending_online_orders(limit: int = 100) -> int:
    now = timezone.now()
    order_ids = list(
        Order.objects.filter(
            status='pending',
            payment_status='pending',
            payment_expires_at__lte=now,
        )
        .exclude(payment_method='cod')
        .order_by('payment_expires_at')
        .values_list('order_id', flat=True)[:limit]
    )
    expired = 0
    for order_id in order_ids:
        order = Order.objects.filter(order_id=order_id).first()
        if order is None:
            continue
        cancel_order_with_stock_restore(
            order,
            reason='Thanh toán quá hạn',
            payment_failure_status='expired',
        )
        Notification.objects.create(
            user=order.user.user,
            title='Đơn hàng đã hết hạn',
            content=f'Đơn hàng #{order.order_id} đã tự hủy vì chưa thanh toán đúng hạn.',
            notification_type='order',
        )
        expired += 1
    return expired


@transaction.atomic
def complete_manual_refund(order: Order, actor, refund_reference: str) -> Order:
    locked_order = Order.objects.select_for_update().get(order_id=order.order_id)
    reference = str(refund_reference or '').strip()
    if locked_order.payment_status != 'refund_pending':
        raise ValueError('Đơn hàng không ở trạng thái chờ hoàn tiền')
    if not reference:
        raise ValueError('Bắt buộc nhập mã tham chiếu hoàn tiền')
    if Payment.objects.filter(refund_reference=reference).exclude(order=locked_order).exists():
        raise ValueError('Mã tham chiếu hoàn tiền đã được sử dụng')

    payment = Payment.objects.select_for_update().filter(order=locked_order).order_by('-payment_id').first()
    if payment is None:
        raise ValueError('Không tìm thấy giao dịch cần hoàn tiền')
    payment.status = 'refunded'
    payment.refund_reference = reference
    payment.refunded_at = timezone.now()
    payment.save(update_fields=['status', 'refund_reference', 'refunded_at', 'updated_at'])
    locked_order.payment_status = 'refunded'
    locked_order.save(update_fields=['payment_status', 'updated_at'])
    Notification.objects.create(
        user=locked_order.user.user,
        title='Đã ghi nhận hoàn tiền',
        content=f'Đơn hàng #{locked_order.order_id} đã được xác nhận hoàn tiền. Mã tham chiếu: {reference}.',
        notification_type='payment',
    )
    return locked_order
