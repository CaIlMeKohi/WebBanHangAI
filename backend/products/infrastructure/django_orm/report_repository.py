from __future__ import annotations

from decimal import Decimal

from products.infrastructure.stored_procedures import (
    report_best_brands,
    report_best_products,
    report_order_status,
    report_revenue,
    report_revenue_by_payment_method,
)


class DjangoOrmReportRepository:
    def revenue(self, from_date: str | None = None, to_date: str | None = None, group_by: str = 'day'):
        normalized_group_by = group_by if group_by in {'day', 'month', 'quarter'} else 'day'
        if normalized_group_by == 'quarter':
            monthly_revenue = report_revenue(from_date=from_date, to_date=to_date, group_by='month')
            revenue = _aggregate_monthly_revenue_by_quarter(monthly_revenue)
        else:
            revenue = report_revenue(from_date=from_date, to_date=to_date, group_by=normalized_group_by)

        return {
            'revenue': revenue,
            'payment_methods': report_revenue_by_payment_method(from_date=from_date, to_date=to_date),
        }

    def order_status(self, from_date: str | None = None, to_date: str | None = None):
        return report_order_status(from_date=from_date, to_date=to_date)

    def best_products(self, from_date: str | None = None, to_date: str | None = None, top: int = 20):
        return report_best_products(from_date=from_date, to_date=to_date, top=top)

    def best_brands(self, from_date: str | None = None, to_date: str | None = None, top: int = 20):
        return report_best_brands(from_date=from_date, to_date=to_date, top=top)


def _aggregate_monthly_revenue_by_quarter(rows: list[dict]) -> list[dict]:
    quarters: dict[str, dict] = {}
    for row in rows:
        period = str(row.get('period') or '')
        try:
            year, month = period.split('-', 1)
            quarter = (int(month) - 1) // 3 + 1
        except (TypeError, ValueError):
            continue

        key = f'{year}-Q{quarter}'
        current = quarters.setdefault(
            key,
            {
                'period': key,
                'total_orders': 0,
                'revenue': Decimal('0'),
                'total_discount': Decimal('0'),
                'total_shipping': Decimal('0'),
            },
        )
        current['total_orders'] += int(row.get('total_orders') or 0)
        current['revenue'] += Decimal(row.get('revenue') or 0)
        current['total_discount'] += Decimal(row.get('total_discount') or 0)
        current['total_shipping'] += Decimal(row.get('total_shipping') or 0)

    return [quarters[key] for key in sorted(quarters)]
