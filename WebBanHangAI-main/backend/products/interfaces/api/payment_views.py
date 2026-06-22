from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.payments.dto import CreatePaymentDTO, PaymentCallbackDTO
from products.application.payments.use_cases import CreatePaymentUseCase, HandlePaymentCallbackUseCase
from products.domain.common.exceptions import NotFoundError
from products.infrastructure.django_orm.payment_repository import DjangoOrmPaymentRepository
from products.security.permissions import IsStoreAuthenticated


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
        return Response(result)


class PaymentCallbackAPIView(APIView):
    def post(self, request, provider):
        try:
            HandlePaymentCallbackUseCase(_payment_repository()).execute(
                provider,
                PaymentCallbackDTO.from_payload(request.data),
            )
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        return Response({'detail': 'Da xu ly callback thanh toan'})
