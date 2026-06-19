from __future__ import annotations

from products.application.ports.repositories.report_repository import ReportRepository
from products.application.reports.dto import ReportQueryDTO


class RevenueReportUseCase:
    def __init__(self, repository: ReportRepository):
        self.repository = repository

    def execute(self, dto: ReportQueryDTO):
        return self.repository.revenue(dto.from_date, dto.to_date, dto.group_by)


class OrderStatusReportUseCase:
    def __init__(self, repository: ReportRepository):
        self.repository = repository

    def execute(self, dto: ReportQueryDTO):
        return self.repository.order_status(dto.from_date, dto.to_date)


class BestProductsReportUseCase:
    def __init__(self, repository: ReportRepository):
        self.repository = repository

    def execute(self, dto: ReportQueryDTO):
        return self.repository.best_products(dto.from_date, dto.to_date, dto.top)


class BestBrandsReportUseCase:
    def __init__(self, repository: ReportRepository):
        self.repository = repository

    def execute(self, dto: ReportQueryDTO):
        return self.repository.best_brands(dto.from_date, dto.to_date, dto.top)
