from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.response import Response

from products.application.admin_config.use_cases import PaymentMethodsQueryUseCase, RecommendationConfigsQueryUseCase
from products.infrastructure.django_orm.admin_config_repository import DjangoOrmAdminConfigRepository
from products.business.serializers import PaymentMethodSerializer, RecommendationConfigSerializer
from products.security.permissions import IsAdmin


def _admin_config_repository() -> DjangoOrmAdminConfigRepository:
    return DjangoOrmAdminConfigRepository()


class PaymentMethodViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = PaymentMethodSerializer

    def get_queryset(self):
        return PaymentMethodsQueryUseCase(_admin_config_repository()).queryset()

    def list(self, request, *args, **kwargs):
        use_case = PaymentMethodsQueryUseCase(_admin_config_repository())
        if not use_case.table_exists():
            return Response(use_case.fallback_rows())
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if not PaymentMethodsQueryUseCase(_admin_config_repository()).table_exists():
            return Response({'detail': 'DB hien tai dang luu phuong thuc thanh toan trong payments.method. Can migration payment_methods rieng neu muon bat/tat hoac luu config.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not PaymentMethodsQueryUseCase(_admin_config_repository()).table_exists():
            return Response({'detail': 'DB hien tai dang luu phuong thuc thanh toan trong payments.method. Can migration payment_methods rieng neu muon bat/tat hoac luu config.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)


class RecommendationConfigViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = RecommendationConfigSerializer

    def get_queryset(self):
        return RecommendationConfigsQueryUseCase(_admin_config_repository()).queryset()

    def list(self, request, *args, **kwargs):
        if not RecommendationConfigsQueryUseCase(_admin_config_repository()).table_exists():
            return Response([])
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if not RecommendationConfigsQueryUseCase(_admin_config_repository()).table_exists():
            return Response({'detail': 'DB hien tai chua co bang recommendation_configs. Can migration neu muon luu cau hinh AI.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not RecommendationConfigsQueryUseCase(_admin_config_repository()).table_exists():
            return Response({'detail': 'DB hien tai chua co bang recommendation_configs. Can migration neu muon luu cau hinh AI.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)
