from datetime import timedelta
import uuid

from django.core import signing
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from products.models import StoreUser, UserSession


TOKEN_SALT = 'fashion-shop-jwt'


def create_access_token(user: StoreUser, request=None) -> str:
    hours = 8 if user.role in {'staff', 'admin'} else 24
    expires_at = timezone.now() + timedelta(hours=hours)
    jwt_id = uuid.uuid4().hex
    payload = {
        'user_id': user.user_id,
        'role': user.role,
        'jti': jwt_id,
        'exp': expires_at.timestamp(),
    }
    UserSession.objects.create(
        user=user,
        jwt_id=jwt_id,
        ip_address=request.META.get('REMOTE_ADDR') if request else None,
        user_agent=request.META.get('HTTP_USER_AGENT', '')[:500] if request else None,
        expires_at=expires_at,
    )
    return signing.dumps(payload, salt=TOKEN_SALT)


def parse_access_token(token: str) -> tuple[StoreUser, dict]:
    try:
        payload = signing.loads(token, salt=TOKEN_SALT, max_age=24 * 60 * 60)
    except signing.BadSignature as exc:
        raise AuthenticationFailed('Token khong hop le.') from exc

    if float(payload.get('exp', 0)) < timezone.now().timestamp():
        raise AuthenticationFailed('Token da het han.')

    user = StoreUser.objects.filter(user_id=payload.get('user_id'), account_status='active').first()
    if user is None:
        raise AuthenticationFailed('Tai khoan khong hop le hoac da bi khoa.')
    jwt_id = payload.get('jti')
    if jwt_id and not UserSession.objects.filter(
        user=user,
        jwt_id=jwt_id,
        revoked_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).exists():
        raise AuthenticationFailed('Phien dang nhap da het han hoac da bi huy.')
    return user, payload


class StoreUserAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return None
        user, payload = parse_access_token(header.removeprefix('Bearer ').strip())
        return (user, payload)
