from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.returns.dto import CreateReturnRequestDTO
from products.application.returns.use_cases import (
    CreateReturnRequestUseCase,
    ListCustomerReturnsUseCase,
    ListStaffReturnsUseCase,
)
from products.domain.common.exceptions import BusinessRuleViolation
from products.infrastructure.django_orm.return_repository import DjangoOrmReturnRepository
from products.security.permissions import CanHandleReturns, IsCustomer
from products.business.serializers import ReturnRequestSerializer


def _return_repository() -> DjangoOrmReturnRepository:
    return DjangoOrmReturnRepository()


class ReturnRequestListCreateAPIView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        return Response(ReturnRequestSerializer(
            ListCustomerReturnsUseCase(_return_repository()).execute(request.user.customer_profile),
            many=True,
        ).data)

    def post(self, request):
        try:
            item = CreateReturnRequestUseCase(_return_repository()).execute(
                request.user.customer_profile,
                CreateReturnRequestDTO.from_payload(request.data),
            )
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ReturnRequestSerializer(item).data, status=status.HTTP_201_CREATED)


class StaffReturnAPIView(APIView):
    permission_classes = [CanHandleReturns]

    def get(self, request):
        return Response(ReturnRequestSerializer(ListStaffReturnsUseCase(_return_repository()).execute(), many=True).data)
