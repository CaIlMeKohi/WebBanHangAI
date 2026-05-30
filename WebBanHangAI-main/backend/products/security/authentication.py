from datetime import timedelta

from django.core import signing
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from products.models import StoreUser


TOKEN_SALT = 'fashion-shop-jwt'


def create_access_token(user: StoreUser) -> str:
    hours = 8 if user.role in {'staff', 'admin'} else 24
    payload = {
        'user_id': user.user_id,
        'role': user.role,
        'exp': (timezone.now() + timedelta(hours=hours)).timestamp(),
    }
    return signing.dumps(payload, salt=TOKEN_SALT)


def parse_access_token(token: str) -> StoreUser:
    try:
        payload = signing.loads(token, salt=TOKEN_SALT, max_age=24 * 60 * 60)
    except signing.BadSignature as exc:
        raise AuthenticationFailed('Token khong hop le.') from exc

    if float(payload.get('exp', 0)) < timezone.now().timestamp():
        raise AuthenticationFailed('Token da het han.')

    user = StoreUser.objects.filter(user_id=payload.get('user_id'), account_status='active').first()
    if user is None:
        raise AuthenticationFailed('Tai khoan khong hop le hoac da bi khoa.')
    return user


class StoreUserAuthentication(BaseAuthentication):
    def authenticate(self, request):
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return None
        user = parse_access_token(header.removeprefix('Bearer ').strip())
        return (user, None)
