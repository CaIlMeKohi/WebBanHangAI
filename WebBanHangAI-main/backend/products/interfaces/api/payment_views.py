from __future__ import annotations

import secrets

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.payments.dto import CreatePaymentDTO, PaymentCallbackDTO
from products.application.payments.use_cases import CreatePaymentUseCase, HandlePaymentCallbackUseCase
from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.infrastructure.django_orm.payment_repository import DjangoOrmPaymentRepository
from products.security.permissions import IsCustomer, IsStoreAuthenticated


def _payment_repository() -> DjangoOrmPaymentRepository:
    return DjangoOrmPaymentRepository()


class PaymentCreateAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def post(self, request):
        try:
            result = CreatePaymentUseCase(_payment_repository()).execute(
                request.user,
                CreatePaymentDTO.from_payload(request.data),
            )
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(result)


class PaymentCallbackAPIView(APIView):
    def post(self, request, provider):
        expected_secret = settings.PAYMENT_WEBHOOK_SECRET
        provided_secret = request.headers.get('X-Payment-Webhook-Secret', '')
        if not expected_secret:
            return Response({'detail': 'Chưa cấu hình secret cho callback thanh toán'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if not secrets.compare_digest(provided_secret, expected_secret):
            return Response({'detail': 'Callback thanh toán không hợp lệ'}, status=status.HTTP_403_FORBIDDEN)
        try:
            HandlePaymentCallbackUseCase(_payment_repository()).execute(
                provider,
                PaymentCallbackDTO.from_payload(request.data),
            )
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Da xu ly callback thanh toan'})


class MockPaymentConfirmAPIView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request):
        if not settings.DEBUG:
            return Response({'detail': 'Thanh toán mô phỏng chỉ dùng trong môi trường phát triển'}, status=status.HTTP_404_NOT_FOUND)
        order_id = request.data.get('order_id')
        customer = getattr(request.user, 'customer_profile', None)
        payment = (
            _payment_repository().get_payment_for_customer(order_id, customer)
            if customer is not None
            else None
        )
        if payment is None:
            return Response({'detail': 'Không tìm thấy giao dịch của bạn'}, status=status.HTTP_404_NOT_FOUND)
        try:
            HandlePaymentCallbackUseCase(_payment_repository()).execute(
                payment.payment_method,
                PaymentCallbackDTO.from_payload({
                    'order_id': order_id,
                    'success': True,
                    'transaction_id': f'DEMO-{order_id}-{secrets.token_hex(4).upper()}',
                    'amount': str(payment.amount),
                    'raw_payload': {'source': 'authenticated_demo_gateway'},
                }),
            )
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Đã xác nhận thanh toán mô phỏng'})
