import logging
import os

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import DatabaseError
from django.utils import timezone


logger = logging.getLogger(__name__)


def _env(name: str, default: str = '') -> str:
    return os.getenv(name, default).strip()


def _create_outbox(to_email: str, subject: str, html: str, related_user_id=None, related_order_id=None):
    try:
        from products.models import EmailOutbox
        return EmailOutbox.objects.create(
            to_email=to_email,
            subject=subject,
            body=html,
            related_user_id=related_user_id,
            related_order_id=related_order_id,
        )
    except DatabaseError:
        logger.exception('Could not create email outbox record.')
        return None


def send_email(to_email: str, subject: str, html: str, text: str = '', related_user_id=None, related_order_id=None) -> dict:
    from_email = settings.DEFAULT_FROM_EMAIL
    outbox = _create_outbox(to_email, subject, html, related_user_id, related_order_id)

    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        logger.warning('Gmail SMTP is not configured; skipped email to %s', to_email)
        if outbox:
            outbox.status = 'pending'
            outbox.error_message = 'missing_gmail_smtp_credentials'
            outbox.save(update_fields=['status', 'error_message'])
        return {'skipped': True, 'reason': 'missing_gmail_smtp_credentials'}

    try:
        message = EmailMultiAlternatives(
            subject=subject,
            body=text or 'Vui lòng xem nội dung email ở định dạng HTML.',
            from_email=from_email,
            to=[to_email],
            reply_to=[settings.EMAIL_HOST_USER],
        )
        message.attach_alternative(html, 'text/html')
        if message.send(fail_silently=False) != 1:
            raise RuntimeError('SMTP server did not confirm email delivery')
        if outbox:
            outbox.status = 'sent'
            outbox.sent_at = timezone.now()
            outbox.last_attempt_at = timezone.now()
            outbox.error_message = None
            outbox.save(update_fields=['status', 'sent_at', 'last_attempt_at', 'error_message'])
        return {'ok': True, 'sent': True}
    except Exception as exc:
        logger.error('Gmail SMTP email failed: %s', exc)
        if outbox:
            outbox.status = 'failed'
            outbox.error_message = str(exc)
            outbox.retry_count += 1
            outbox.last_attempt_at = timezone.now()
            outbox.save(update_fields=['status', 'error_message', 'retry_count', 'last_attempt_at'])
        return {'error': True, 'detail': str(exc)}


def send_verification_email(to_email: str, token: str) -> dict:
    frontend_url = _env('FRONTEND_PUBLIC_URL', 'http://127.0.0.1:5173')
    verify_url = f'{frontend_url}/verify-email?token={token}'
    return send_email(
        to_email,
        'Xac thuc tai khoan Fashion Shop',
        f'<p>Chao ban,</p><p>Vui long bam vao lien ket sau de xac thuc email:</p><p><a href="{verify_url}">{verify_url}</a></p><p>Link co hieu luc 24 gio.</p>',
        f'Xac thuc email: {verify_url}',
    )


def send_password_reset_otp(to_email: str, otp: str) -> dict:
    return send_email(
        to_email,
        'Ma OTP khoi phuc mat khau Fashion Shop',
        f'<p>Ma OTP cua ban la:</p><h2>{otp}</h2><p>Ma co hieu luc 10 phut.</p>',
        f'Ma OTP cua ban la {otp}. Ma co hieu luc 10 phut.',
    )


def send_registration_otp(to_email: str, otp: str) -> dict:
    return send_email(
        to_email,
        'Mã OTP xác thực tài khoản Fashion Shop',
        f'<p>Chào bạn,</p><p>Mã OTP xác thực tài khoản của bạn là:</p><h2>{otp}</h2><p>Mã có hiệu lực trong 10 phút.</p>',
        f'Mã OTP xác thực tài khoản của bạn là {otp}. Mã có hiệu lực trong 10 phút.',
    )


def send_order_confirmation(to_email: str, order_id: int, final_amount: int) -> dict:
    return send_email(
        to_email,
        f'Xac nhan don hang #{order_id}',
        f'<p>Don hang #{order_id} da duoc tao thanh cong.</p><p>Tong thanh toan: {final_amount:,} VND</p>',
        f'Don hang #{order_id} da duoc tao thanh cong. Tong thanh toan: {final_amount:,} VND',
        related_order_id=order_id,
    )


def send_order_status_email(to_email: str, order_id: int, next_status: str) -> dict:
    return send_email(
        to_email,
        f'Cap nhat don hang #{order_id}',
        f'<p>Don hang #{order_id} da chuyen sang trang thai <strong>{next_status}</strong>.</p>',
        f'Don hang #{order_id} da chuyen sang trang thai {next_status}.',
    )
