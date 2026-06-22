import json
import logging
import os
from urllib import error, request


logger = logging.getLogger(__name__)


RESEND_EMAILS_URL = 'https://api.resend.com/emails'


def _env(name: str, default: str = '') -> str:
    return os.getenv(name, default).strip()


def send_email(to_email: str, subject: str, html: str, text: str = '') -> dict:
    api_key = _env('RESEND_API_KEY')
    from_email = _env('RESEND_FROM_EMAIL', 'Fashion Shop <onboarding@resend.dev>')

    if not api_key:
        logger.warning('RESEND_API_KEY is not configured; skipped email to %s', to_email)
        return {'skipped': True, 'reason': 'missing_resend_api_key'}

    payload = {
        'from': from_email,
        'to': [to_email],
        'subject': subject,
        'html': html,
    }
    if text:
        payload['text'] = text

    body = json.dumps(payload).encode('utf-8')
    req = request.Request(
        RESEND_EMAILS_URL,
        data=body,
        method='POST',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'User-Agent': 'FashionShopAI/1.0',
        },
    )

    try:
        with request.urlopen(req, timeout=10) as response:
            raw = response.read().decode('utf-8')
            return json.loads(raw) if raw else {'ok': True}
    except error.HTTPError as exc:
        detail = exc.read().decode('utf-8', errors='replace')
        logger.exception('Resend email failed with HTTP %s: %s', exc.code, detail)
        return {'error': True, 'status': exc.code, 'detail': detail}
    except Exception as exc:
        logger.exception('Resend email failed: %s', exc)
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


def send_order_confirmation(to_email: str, order_id: int, final_amount: int) -> dict:
    return send_email(
        to_email,
        f'Xac nhan don hang #{order_id}',
        f'<p>Don hang #{order_id} da duoc tao thanh cong.</p><p>Tong thanh toan: {final_amount:,} VND</p>',
        f'Don hang #{order_id} da duoc tao thanh cong. Tong thanh toan: {final_amount:,} VND',
    )


def send_order_status_email(to_email: str, order_id: int, next_status: str) -> dict:
    return send_email(
        to_email,
        f'Cap nhat don hang #{order_id}',
        f'<p>Don hang #{order_id} da chuyen sang trang thai <strong>{next_status}</strong>.</p>',
        f'Don hang #{order_id} da chuyen sang trang thai {next_status}.',
    )
