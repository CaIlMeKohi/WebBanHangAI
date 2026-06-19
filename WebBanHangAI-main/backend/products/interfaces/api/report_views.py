from __future__ import annotations

from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.reports.dto import ReportQueryDTO
from products.application.reports.use_cases import (
    BestBrandsReportUseCase,
    BestProductsReportUseCase,
    OrderStatusReportUseCase,
    RevenueReportUseCase,
)
from products.infrastructure.django_orm.report_repository import DjangoOrmReportRepository
from products.security.permissions import IsAdmin


def _report_repository() -> DjangoOrmReportRepository:
    return DjangoOrmReportRepository()


class ReportsRevenueAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(RevenueReportUseCase(_report_repository()).execute(ReportQueryDTO.from_query_params(request.query_params)))


class ReportsOrderStatusAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(OrderStatusReportUseCase(_report_repository()).execute(ReportQueryDTO.from_query_params(request.query_params)))


class ReportsBestProductsAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(BestProductsReportUseCase(_report_repository()).execute(ReportQueryDTO.from_query_params(request.query_params)))


class ReportsBestBrandsAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(BestBrandsReportUseCase(_report_repository()).execute(ReportQueryDTO.from_query_params(request.query_params)))
