from __future__ import annotations

import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone

from products.domain.common.exceptions import BusinessRuleViolation, EmailDeliveryError
from products.models import EmailVerificationToken, PasswordResetOTP, StoreUser, UserSession
from products.serializers import RegisterSerializer
from products.services.email_service import send_password_reset_otp, send_registration_otp, send_verification_email


class DjangoOrmAuthSecurityRepository:
    PASSWORD_RESET_SALT = 'fashion-shop-password-reset'
    def verify_registration(self, email: str, otp: str) -> None:
        user = StoreUser.objects.filter(email=email, account_status='pending_verification').first()
        record = PasswordResetOTP.objects.filter(user=user, used_at__isnull=True).order_by('-created_at').first() if user else None
        if record is None or record.expires_at < timezone.now():
            raise BusinessRuleViolation('OTP không hợp lệ hoặc đã hết hạn')
        if not check_password(otp, record.otp_hash):
            record.failed_attempts += 1
            if record.failed_attempts >= 3:
                record.used_at = timezone.now()
                record.save(update_fields=['failed_attempts', 'used_at'])
                raise BusinessRuleViolation('OTP đã bị hủy do nhập sai 3 lần')
            record.save(update_fields=['failed_attempts'])
            raise BusinessRuleViolation('OTP không đúng')
        now = timezone.now()
        user.account_status = 'active'
        user.email_verified_at = now
        record.used_at = now
        with transaction.atomic():
            user.save(update_fields=['account_status', 'email_verified_at'])
            record.save(update_fields=['used_at'])

    def resend_registration_otp(self, email: str) -> dict:
        user = StoreUser.objects.filter(email=email, account_status='pending_verification').first()
        if user is None:
            return {'detail': 'Nếu tài khoản đang chờ xác thực, OTP sẽ được gửi.'}
        latest = PasswordResetOTP.objects.filter(user=user).order_by('-created_at').first()
        if latest and latest.created_at > timezone.now() - timedelta(seconds=60):
            raise BusinessRuleViolation('Vui lòng đợi 60 giây trước khi gửi lại')
        otp = f'{secrets.randbelow(1_000_000):06d}'
        PasswordResetOTP.objects.create(user=user, otp_hash=make_password(otp), expires_at=timezone.now() + timedelta(minutes=10))
        result = send_registration_otp(user.email, otp)
        if result.get('error') or result.get('skipped'):
            PasswordResetOTP.objects.filter(user=user, used_at__isnull=True).order_by('-created_at').first().delete()
            raise EmailDeliveryError('Không thể gửi lại OTP. Vui lòng kiểm tra cấu hình Gmail SMTP và thử lại.')
        payload = {'detail': 'Mã OTP mới đã được gửi đến email đăng ký.'}
        if settings.DEBUG and result.get('skipped'):
            payload['dev_otp'] = otp
        return payload

    def verify_email(self, token: str) -> None:
        record = EmailVerificationToken.objects.select_related('user').filter(token=token, used_at__isnull=True).first()
        if record is None or record.expires_at < timezone.now():
            raise BusinessRuleViolation('Token xac thuc khong hop le hoac da het han')
        record.used_at = timezone.now()
        record.user.email_verified_at = timezone.now()
        with transaction.atomic():
            record.save(update_fields=['used_at'])
            record.user.save(update_fields=['email_verified_at'])

    def resend_verification(self, user):
        latest = EmailVerificationToken.objects.filter(user=user).order_by('-created_at').first()
        if latest and latest.last_sent_at > timezone.now() - timedelta(seconds=60):
            raise BusinessRuleViolation('Vui long doi 60 giay truoc khi gui lai')
        token = secrets.token_urlsafe(48)
        EmailVerificationToken.objects.create(user=user, token=token, expires_at=timezone.now() + timedelta(hours=24))
        result = send_verification_email(user.email, token)
        payload = {'detail': 'Đã gửi email xác thực nếu Gmail SMTP đã được cấu hình'}
        if result.get('skipped'):
            payload['dev_token'] = token
        return payload

    def forgot_password(self, email: str):
        user = StoreUser.objects.filter(email=email, account_status='active').first()
        if not user:
            return {'detail': 'Neu email ton tai, OTP se duoc gui'}
        latest = PasswordResetOTP.objects.filter(user=user).order_by('-created_at').first()
        if latest and latest.created_at > timezone.now() - timedelta(seconds=60):
            raise BusinessRuleViolation('Vui lòng đợi 60 giây trước khi gửi lại OTP')
        otp = f'{secrets.randbelow(1_000_000):06d}'
        record = PasswordResetOTP.objects.create(user=user, otp_hash=make_password(otp), expires_at=timezone.now() + timedelta(minutes=10))
        result = send_password_reset_otp(user.email, otp)
        if result.get('error') or result.get('skipped'):
            record.delete()
            raise EmailDeliveryError('Không thể gửi OTP. Vui lòng kiểm tra cấu hình Gmail SMTP và thử lại.')
        payload = {'detail': 'OTP đã được gửi nếu Gmail SMTP đã được cấu hình'}
        if settings.DEBUG and result.get('skipped'):
            payload['dev_otp'] = otp
        return payload

    def reset_password(self, payload: dict) -> None:
        reset_token = str(payload.get('reset_token', '')).strip()
        password = str(payload.get('password', ''))
        try:
            token_data = signing.loads(reset_token, salt=self.PASSWORD_RESET_SALT, max_age=10 * 60)
        except signing.BadSignature as exc:
            raise BusinessRuleViolation('Phiên đổi mật khẩu không hợp lệ hoặc đã hết hạn') from exc
        user = StoreUser.objects.filter(user_id=token_data.get('user_id'), account_status='active').first()
        record = PasswordResetOTP.objects.filter(
            otp_id=token_data.get('otp_id'), user=user, used_at__isnull=True
        ).first() if user else None
        if record is None or record.expires_at < timezone.now():
            raise BusinessRuleViolation('Phiên đổi mật khẩu không hợp lệ hoặc đã hết hạn')
        if check_password(password, user.password_hash):
            raise BusinessRuleViolation('Mat khau moi khong duoc trung mat khau cu')
        serializer = RegisterSerializer(data={'username': user.email, 'full_name': user.email, 'password': password})
        serializer.is_valid(raise_exception=True)
        user.password_hash = make_password(password)
        record.used_at = timezone.now()
        with transaction.atomic():
            user.save(update_fields=['password_hash'])
            record.save(update_fields=['used_at'])
            UserSession.objects.filter(user=user, revoked_at__isnull=True).update(revoked_at=timezone.now())

    def verify_password_reset_otp(self, email: str, otp: str) -> dict:
        user = StoreUser.objects.filter(email=email.strip().lower(), account_status='active').first()
        record = PasswordResetOTP.objects.filter(user=user, used_at__isnull=True).order_by('-created_at').first() if user else None
        if record is None or record.expires_at < timezone.now():
            raise BusinessRuleViolation('OTP không hợp lệ hoặc đã hết hạn')
        if not check_password(otp.strip(), record.otp_hash):
            record.failed_attempts += 1
            if record.failed_attempts >= 3:
                record.used_at = timezone.now()
                record.save(update_fields=['failed_attempts', 'used_at'])
                raise BusinessRuleViolation('OTP đã bị hủy do nhập sai 3 lần')
            record.save(update_fields=['failed_attempts'])
            raise BusinessRuleViolation('OTP không đúng')
        reset_token = signing.dumps(
            {'user_id': user.user_id, 'otp_id': record.otp_id},
            salt=self.PASSWORD_RESET_SALT,
            compress=True,
        )
        return {'detail': 'Xác nhận OTP thành công', 'reset_token': reset_token}

    def change_password(self, user, payload: dict) -> None:
        old_password = str(payload.get('old_password', ''))
        new_password = str(payload.get('new_password', ''))
        if not check_password(old_password, user.password_hash):
            raise BusinessRuleViolation('Mat khau cu khong dung')
        if check_password(new_password, user.password_hash):
            raise BusinessRuleViolation('Mat khau moi khong duoc trung mat khau cu')
        serializer = RegisterSerializer(data={'username': user.email, 'full_name': user.email, 'password': new_password})
        serializer.is_valid(raise_exception=True)
        user.password_hash = make_password(new_password)
        user.must_change_password = False
        user.save(update_fields=['password_hash', 'must_change_password'])
