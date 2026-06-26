from __future__ import annotations

import secrets
from datetime import timedelta

from django.contrib.auth.hashers import check_password, make_password
from django.db.models import Q
from django.utils import timezone

from products.domain.common.exceptions import BusinessRuleViolation, EmailDeliveryError, NotFoundError
from products.models import Address, Customer, LoginLog, PasswordResetOTP, StaffProfile, StoreUser, UserSession
from products.security.authentication import create_access_token
from products.serializers import AuthSerializer, RegisterSerializer, StoreUserSerializer
from products.services.email_service import send_registration_otp


MAX_FAILED_LOGIN_ATTEMPTS = 5
TEMP_LOCK_SECONDS = 30


class DjangoOrmUserRepository:
    def logout(self, user, auth) -> None:
        jwt_id = (auth or {}).get('jti')
        if jwt_id:
            UserSession.objects.filter(user=user, jwt_id=jwt_id, revoked_at__isnull=True).update(revoked_at=timezone.now())

    def list_users(self):
        return StoreUser.objects.all().order_by('-created_at')

    def lock_user(self, user_id: int):
        user = StoreUser.objects.filter(user_id=user_id).first()
        if user is None:
            raise NotFoundError('User not found')
        user.account_status = 'locked'
        user.save(update_fields=['account_status'])
        return user

    def unlock_user(self, user_id: int):
        user = StoreUser.objects.filter(user_id=user_id).first()
        if user is None:
            raise NotFoundError('User not found')
        user.account_status = 'active'
        user.locked_until = None
        user.failed_login_count = 0
        user.save(update_fields=['account_status', 'locked_until', 'failed_login_count'])
        return user

    def update_user(self, user_id: int, values: dict):
        user = StoreUser.objects.select_for_update().filter(user_id=user_id).first()
        if user is None:
            raise NotFoundError('User not found')
        email = values.get('email')
        if email and StoreUser.objects.exclude(user_id=user_id).filter(email=email).exists():
            raise BusinessRuleViolation('Email da duoc su dung')
        full_name = values.pop('full_name', None)
        for field, value in values.items():
            setattr(user, field, value)
        user.save(update_fields=[*values.keys(), 'updated_at'])
        if full_name is not None and hasattr(user, 'customer_profile'):
            user.customer_profile.full_name = full_name.strip()
            user.customer_profile.save(update_fields=['full_name', 'updated_at'])
        return user, [*values.keys(), *(['full_name'] if full_name is not None else [])]

    def delete_user(self, actor, user_id: int):
        if actor.user_id == user_id:
            raise BusinessRuleViolation('Admin khong duoc tu xoa tai khoan dang dang nhap')
        user = StoreUser.objects.select_for_update().filter(user_id=user_id).first()
        if user is None:
            raise NotFoundError('User not found')
        previous_status = user.account_status
        user.account_status = 'inactive'
        user.locked_until = None
        user.save(update_fields=['account_status', 'locked_until', 'updated_at'])
        return user, {'account_status': previous_status}

    def create_staff_or_admin(self, payload: dict):
        email = str(payload.get('email', '')).strip().lower()
        password = str(payload.get('password', ''))
        role = payload.get('role', 'staff')
        if role not in {'staff', 'admin'}:
            raise BusinessRuleViolation('Role khong hop le')
        if len(password) < 12:
            raise BusinessRuleViolation('Mat khau nhan vien/admin toi thieu 12 ky tu')
        if not email:
            raise BusinessRuleViolation('Email khong duoc de trong')
        if StoreUser.objects.filter(email=email).exists():
            raise BusinessRuleViolation('Email da ton tai trong he thong')
        phone = str(payload.get('phone') or '').strip() or None
        if phone and StoreUser.objects.filter(phone=phone).exists():
            raise BusinessRuleViolation('So dien thoai da ton tai trong he thong')
        user = StoreUser.objects.create(
            email=email,
            phone=phone,
            password_hash=make_password(password),
            role=role,
            account_status='active',
            must_change_password=True,
        )
        if role == 'staff':
            StaffProfile.objects.create(
                user=user,
                staff_code=f'NV{user.user_id:06d}',
                full_name=payload.get('full_name', email),
                position=payload.get('position', 'staff'),
                department=payload.get('department', 'operations'),
                status='working',
            )
        return user

    def login(self, payload: dict, request):
        serializer = AuthSerializer(data=payload)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data['username'].strip().lower()
        password = serializer.validated_data['password']
        ip_address = request.META.get('REMOTE_ADDR', '')

        user = StoreUser.objects.filter(Q(email=username) | Q(phone=username)).first()
        if not user or not user.is_active:
            LoginLog.objects.create(user=user, identifier=username, success=False, ip_address=ip_address, reason='inactive_or_missing')
            raise BusinessRuleViolation('Dang nhap khong thanh cong!')
        if user.locked_until and user.locked_until > timezone.now():
            remaining_seconds = max(1, int((user.locked_until - timezone.now()).total_seconds()))
            LoginLog.objects.create(user=user, identifier=username, success=False, ip_address=ip_address, reason='temporarily_locked')
            raise BusinessRuleViolation(f'Chuc nang dang nhap dang bi khoa tam thoi. Vui long thu lai sau {remaining_seconds} giay.')
        if user.locked_until and user.locked_until <= timezone.now():
            user.locked_until = None
            user.failed_login_count = 0
            user.save(update_fields=['locked_until', 'failed_login_count', 'updated_at'])
        if not check_password(password, user.password_hash):
            user.failed_login_count = (user.failed_login_count or 0) + 1
            update_fields = ['failed_login_count', 'updated_at']
            reason = 'bad_password'
            if user.failed_login_count >= MAX_FAILED_LOGIN_ATTEMPTS:
                user.locked_until = timezone.now() + timedelta(seconds=TEMP_LOCK_SECONDS)
                update_fields.append('locked_until')
                reason = 'temporarily_locked_after_failures'
            user.save(update_fields=update_fields)
            LoginLog.objects.create(user=user, identifier=username, success=False, ip_address=ip_address, reason=reason)
            if user.locked_until and user.locked_until > timezone.now():
                raise BusinessRuleViolation(f'Dang nhap sai nhieu lan, bi khoa tam {TEMP_LOCK_SECONDS} giay.')
            raise BusinessRuleViolation('Dang nhap khong thanh cong!')

        user.failed_login_count = 0
        user.locked_until = None
        user.last_login_at = timezone.now()
        user.save(update_fields=['failed_login_count', 'locked_until', 'last_login_at', 'updated_at'])
        LoginLog.objects.create(user=user, identifier=username, success=True, ip_address=ip_address)
        return {
            'user': StoreUserSerializer(user).data,
            'access': create_access_token(user, request),
            'expires_in_hours': 8 if user.role in {'staff', 'admin'} else 24,
        }

    def register_customer(self, payload: dict, request):
        serializer = RegisterSerializer(data=payload)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data['username'].strip().lower()
        password = serializer.validated_data['password']
        email = username
        phone = serializer.validated_data.get('phone', '').strip()

        if StoreUser.objects.filter(email=email).exists():
            raise BusinessRuleViolation('User already exists')
        if phone and StoreUser.objects.filter(phone=phone).exists():
            raise BusinessRuleViolation('Phone already exists')

        user = StoreUser.objects.create(
            email=email,
            phone=phone or None,
            password_hash=make_password(password),
            role='customer',
            account_status='pending_verification',
        )
        Customer.objects.create(
            user=user,
            customer_code=f'KH{user.user_id:06d}',
            full_name=serializer.validated_data['full_name'],
            gender=serializer.validated_data.get('gender', 'unknown'),
            birthday=serializer.validated_data.get('birthday'),
        )
        customer = user.customer_profile
        address_line = str(payload.get('address_line', '')).strip()
        ward = str(payload.get('ward', '')).strip()
        district = str(payload.get('district', '')).strip()
        province = str(payload.get('province', '')).strip()
        if address_line and ward and district and province:
            Address.objects.create(
                user=customer,
                full_name=serializer.validated_data['full_name'],
                phone=phone or '',
                address_line=address_line,
                ward=ward,
                district=district,
                province=province,
                is_default=True,
            )
        otp = f'{secrets.randbelow(1_000_000):06d}'
        PasswordResetOTP.objects.create(
            user=user,
            otp_hash=make_password(otp),
            expires_at=timezone.now() + timedelta(minutes=10),
        )
        email_result = send_registration_otp(user.email, otp)
        if email_result.get('error') or email_result.get('skipped'):
            user.delete()
            raise EmailDeliveryError('Không thể gửi OTP đăng ký. Vui lòng kiểm tra cấu hình Gmail SMTP và thử lại.')
        response_payload = {
            'detail': 'Mã OTP đã được gửi đến email đăng ký.',
            'email': user.email,
            'requires_otp': True,
        }
        return response_payload, 201
