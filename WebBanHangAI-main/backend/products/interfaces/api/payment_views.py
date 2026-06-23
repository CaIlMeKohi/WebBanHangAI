from __future__ import annotations

import json

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.payments.dto import CreatePaymentDTO, PaymentCallbackDTO
from products.application.payments.use_cases import (
    CreatePaymentUseCase,
    GetPaymentStatusUseCase,
    HandlePaymentCallbackUseCase,
    ReorderAsCODUseCase,
    SwitchPaymentToCODUseCase,
)
from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.infrastructure.django_orm.payment_repository import DjangoOrmPaymentRepository
from products.security.permissions import IsStoreAuthenticated
from products.services.payos_service import InvalidPayOSWebhook, PayOSConfigurationError, PayOSGatewayError, verify_payos_webhook
from products.serializers import OrderSerializer


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
        except PayOSConfigurationError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except PayOSGatewayError as exc:
            return Response({'detail': f'payOS error: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result)


class PayOSWebhookAPIView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        try:
            raw_payload = json.loads(request.body.decode('utf-8'))
            verified = verify_payos_webhook(request.body)
            HandlePaymentCallbackUseCase(_payment_repository()).execute(
                'payos',
                PaymentCallbackDTO(
                    order_id=verified['order_id'],
                    success=verified['success'],
                    transaction_id=verified['transaction_id'],
                    amount=verified['amount'],
                    payment_link_id=verified['payment_link_id'],
                    raw_payload=raw_payload,
                ),
            )
        except (InvalidPayOSWebhook, json.JSONDecodeError, UnicodeDecodeError) as exc:
            return Response({'detail': f'Invalid payOS webhook: {exc}'}, status=status.HTTP_400_BAD_REQUEST)
        except PayOSConfigurationError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'success': True})


class PaymentStatusAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def get(self, request, order_id):
        try:
            result = GetPaymentStatusUseCase(_payment_repository()).execute(request.user, order_id)
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except PayOSConfigurationError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except PayOSGatewayError as exc:
            return Response({'detail': f'payOS error: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result)


class SwitchPaymentToCODAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def post(self, request, order_id):
        try:
            result = SwitchPaymentToCODUseCase(_payment_repository()).execute(request.user, order_id)
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except (PayOSConfigurationError, PayOSGatewayError) as exc:
            return Response({'detail': f'payOS error: {exc}'}, status=status.HTTP_502_BAD_GATEWAY)
        return Response(result)


class ReorderAsCODAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def post(self, request, order_id):
        try:
            order = ReorderAsCODUseCase(_payment_repository()).execute(request.user, order_id)
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)
