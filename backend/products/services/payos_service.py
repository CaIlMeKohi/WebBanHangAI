from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.conf import settings
from django.utils import timezone
from payos import PayOS, PayOSError, WebhookError
from payos.types import CreatePaymentLinkRequest


class PayOSConfigurationError(Exception):
    pass


class PayOSGatewayError(Exception):
    pass


class InvalidPayOSWebhook(Exception):
    pass


def _client() -> PayOS:
    missing = [
        name
        for name, value in {
            'PAYOS_CLIENT_ID': settings.PAYOS_CLIENT_ID,
            'PAYOS_API_KEY': settings.PAYOS_API_KEY,
            'PAYOS_CHECKSUM_KEY': settings.PAYOS_CHECKSUM_KEY,
        }.items()
        if not value
    ]
    if missing:
        raise PayOSConfigurationError(f"Missing payOS configuration: {', '.join(missing)}")
    return PayOS(
        client_id=settings.PAYOS_CLIENT_ID,
        api_key=settings.PAYOS_API_KEY,
        checksum_key=settings.PAYOS_CHECKSUM_KEY,
    )


def create_payos_payment_link(*, order_id: int, amount: int) -> dict[str, Any]:
    expires_at = timezone.now() + timedelta(minutes=settings.PAYOS_PAYMENT_TIMEOUT_MINUTES)
    description = f'DH{order_id}'
    if len(description) > 9:
        description = str(order_id)[-9:]

    request = CreatePaymentLinkRequest(
        orderCode=order_id,
        amount=amount,
        description=description,
        cancelUrl=settings.PAYOS_CANCEL_URL,
        returnUrl=settings.PAYOS_RETURN_URL,
        expiredAt=int(expires_at.timestamp()),
    )
    try:
        response = _client().payment_requests.create(request)
    except PayOSError as exc:
        raise PayOSGatewayError(str(exc)) from exc

    return {
        'checkout_url': response.checkout_url,
        'qr_code': response.qr_code,
        'payment_link_id': response.payment_link_id,
        'order_code': response.order_code,
        'amount': response.amount,
        'status': response.status,
        'expires_at': expires_at,
    }


def get_payos_payment_status(payment_link_id_or_order_code: str | int) -> dict[str, Any]:
    try:
        response = _client().payment_requests.get(payment_link_id_or_order_code)
    except PayOSError as exc:
        raise PayOSGatewayError(str(exc)) from exc

    latest_transaction = response.transactions[-1] if response.transactions else None
    return {
        'payment_link_id': response.id,
        'order_code': response.order_code,
        'amount': response.amount,
        'amount_paid': response.amount_paid,
        'amount_remaining': response.amount_remaining,
        'status': response.status,
        'transaction_id': latest_transaction.reference if latest_transaction else None,
    }


def cancel_payos_payment_link(payment_link_id_or_order_code: str | int, reason: str) -> dict[str, Any]:
    try:
        response = _client().payment_requests.cancel(payment_link_id_or_order_code, reason)
    except PayOSError as exc:
        raise PayOSGatewayError(str(exc)) from exc
    return {
        'payment_link_id': response.id,
        'order_code': response.order_code,
        'status': response.status,
    }


def verify_payos_webhook(payload: bytes) -> dict[str, Any]:
    try:
        data = _client().webhooks.verify(payload)
    except (WebhookError, PayOSError, ValueError, UnicodeDecodeError) as exc:
        raise InvalidPayOSWebhook(str(exc)) from exc

    return {
        'order_id': data.order_code,
        'amount': data.amount,
        'transaction_id': data.reference,
        'payment_link_id': data.payment_link_id,
        'success': data.code == '00',
    }


def confirm_payos_webhook(webhook_url: str):
    try:
        return _client().webhooks.confirm(webhook_url)
    except PayOSError as exc:
        raise PayOSGatewayError(str(exc)) from exc
