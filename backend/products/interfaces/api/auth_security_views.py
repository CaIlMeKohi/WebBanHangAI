from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.auth_security.use_cases import (
    ChangePasswordUseCase,
    ForgotPasswordUseCase,
    ResendVerificationUseCase,
    ResetPasswordUseCase,
    VerifyPasswordResetOTPUseCase,
    VerifyEmailUseCase,
)
from products.domain.common.exceptions import BusinessRuleViolation, EmailDeliveryError
from products.infrastructure.django_orm.auth_security_repository import DjangoOrmAuthSecurityRepository
from products.security.permissions import IsStoreAuthenticated


def _auth_security_repository() -> DjangoOrmAuthSecurityRepository:
    return DjangoOrmAuthSecurityRepository()


class VerifyEmailAPIView(APIView):
    def post(self, request):
        try:
            VerifyEmailUseCase(_auth_security_repository()).execute(str(request.data.get('token', '')).strip())
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Xac thuc email thanh cong'})


class VerifyRegistrationOTPAPIView(APIView):
    def post(self, request):
        try:
            _auth_security_repository().verify_registration(
                str(request.data.get('email', '')).strip().lower(),
                str(request.data.get('otp', '')).strip(),
            )
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Xác thực tài khoản thành công'})


class ResendRegistrationOTPAPIView(APIView):
    def post(self, request):
        try:
            payload = _auth_security_repository().resend_registration_otp(
                str(request.data.get('email', '')).strip().lower()
            )
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except EmailDeliveryError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(payload)


class ResendVerificationAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def post(self, request):
        try:
            return Response(ResendVerificationUseCase(_auth_security_repository()).execute(request.user))
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_429_TOO_MANY_REQUESTS)


class ForgotPasswordAPIView(APIView):
    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        try:
            return Response(ForgotPasswordUseCase(_auth_security_repository()).execute(email))
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        except EmailDeliveryError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


class ResetPasswordAPIView(APIView):
    def post(self, request):
        try:
            ResetPasswordUseCase(_auth_security_repository()).execute(request.data)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Doi mat khau thanh cong'})


class VerifyPasswordResetOTPAPIView(APIView):
    def post(self, request):
        try:
            payload = VerifyPasswordResetOTPUseCase(_auth_security_repository()).execute(
                str(request.data.get('email', '')).strip().lower(),
                str(request.data.get('otp', '')).strip(),
            )
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload)


class ChangePasswordAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def post(self, request):
        try:
            ChangePasswordUseCase(_auth_security_repository()).execute(request.user, request.data)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Doi mat khau thanh cong'})
