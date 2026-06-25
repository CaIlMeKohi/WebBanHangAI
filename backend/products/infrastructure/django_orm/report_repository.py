from __future__ import annotations

from products.infrastructure.stored_procedures import (
    report_best_brands,
    report_best_products,
    report_order_status,
    report_revenue,
    report_revenue_by_payment_method,
)


class DjangoOrmReportRepository:
    def revenue(self, from_date: str | None = None, to_date: str | None = None, group_by: str = 'day'):
        return {
            'revenue': report_revenue(from_date=from_date, to_date=to_date, group_by=group_by),
            'payment_methods': report_revenue_by_payment_method(from_date=from_date, to_date=to_date),
        }

    def order_status(self, from_date: str | None = None, to_date: str | None = None):
        return report_order_status(from_date=from_date, to_date=to_date)

    def best_products(self, from_date: str | None = None, to_date: str | None = None, top: int = 20):
        return report_best_products(from_date=from_date, to_date=to_date, top=top)

    def best_brands(self, from_date: str | None = None, to_date: str | None = None, top: int = 20):
        return report_best_brands(from_date=from_date, to_date=to_date, top=top)
