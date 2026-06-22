from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.inventory.dto import AdjustStockDTO
from products.application.inventory.use_cases import AdjustVariantStockUseCase, ListLowStockUseCase, ListStockVariantsUseCase
from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.infrastructure.django_orm.inventory_repository import DjangoOrmInventoryRepository
from products.security.permissions import CanManageInventory
from products.serializers import ProductVariantSerializer


def _inventory_repository() -> DjangoOrmInventoryRepository:
    return DjangoOrmInventoryRepository()


class InventoryAdjustAPIView(APIView):
    permission_classes = [CanManageInventory]

    def post(self, request):
        try:
            dto = AdjustStockDTO.from_payload(request.data)
        except (TypeError, ValueError):
            return Response({'detail': 'change_quantity khong hop le'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            variant = AdjustVariantStockUseCase(_inventory_repository()).execute(request.user, dto)
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ProductVariantSerializer(variant).data)


class LowStockAPIView(APIView):
    permission_classes = [CanManageInventory]

    def get(self, request):
        return Response(ListLowStockUseCase(_inventory_repository()).execute())


class StockVariantListAPIView(APIView):
    permission_classes = [CanManageInventory]

    def get(self, request):
        return Response(ListStockVariantsUseCase(_inventory_repository()).execute())
