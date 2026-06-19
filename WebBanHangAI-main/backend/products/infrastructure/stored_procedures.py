from __future__ import annotations

from django.db import connection


def _dictfetchall(cursor):
    columns = [column[0] for column in cursor.description or []]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def call_sp(name: str, params: list | tuple | None = None) -> list[dict]:
    params = list(params or [])
    placeholders = ', '.join(['%s'] * len(params))
    sql = f'EXEC {name} {placeholders}' if placeholders else f'EXEC {name}'
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        if cursor.description is None:
            return []
        return _dictfetchall(cursor)


def report_revenue(from_date=None, to_date=None, group_by='day') -> list[dict]:
    return call_sp('sp_ReportRevenue', [from_date, to_date, group_by])


def report_revenue_by_payment_method(from_date=None, to_date=None) -> list[dict]:
    return call_sp('sp_ReportRevenueByPaymentMethod', [from_date, to_date])


def report_order_status(from_date=None, to_date=None) -> list[dict]:
    return call_sp('sp_ReportOrderStatus', [from_date, to_date])


def report_best_products(from_date=None, to_date=None, top=20) -> list[dict]:
    return call_sp('sp_ReportBestSellingProducts', [from_date, to_date, top])


def report_best_brands(from_date=None, to_date=None, top=20) -> list[dict]:
    return call_sp('sp_ReportBestSellingBrands', [from_date, to_date, top])


def low_stock_variants() -> list[dict]:
    return call_sp('sp_GetLowStockVariants')


def update_order_status(
    order_id: int,
    next_status: str,
    actor_user_id: int | None = None,
    carrier_name: str | None = None,
) -> dict | None:
    rows = call_sp('sp_UpdateOrderStatus', [order_id, next_status, actor_user_id, carrier_name])
    return rows[0] if rows else None


def cancel_order_and_restore_stock(
    order_id: int,
    actor_user_id: int | None = None,
    reason: str | None = None,
) -> dict | None:
    rows = call_sp('sp_CancelOrderAndRestoreStock', [order_id, actor_user_id, reason])
    return rows[0] if rows else None


def refund_order(
    order_id: int,
    actor_user_id: int | None = None,
    reason: str | None = None,
    restore_stock: bool = False,
) -> dict | None:
    rows = call_sp('sp_RefundOrder', [order_id, actor_user_id, reason, 1 if restore_stock else 0])
    return rows[0] if rows else None


def hard_delete_product(product_id: int) -> dict:
    rows = call_sp('sp_HardDeleteProduct', [product_id])
    return rows[0] if rows else {'deleted': False, 'reason': 'Product could not be deleted.'}


def check_variant_stock(variant_id: int, quantity: int) -> dict | None:
    rows = call_sp('sp_CheckVariantStock', [variant_id, quantity])
    return rows[0] if rows else None


def decrease_variant_stock(variant_id: int, quantity: int, order_id: int | None = None) -> bool:
    rows = call_sp('sp_DecreaseVariantStock', [variant_id, quantity, order_id])
    return bool(rows and rows[0].get('affected_rows'))


def adjust_variant_stock(
    variant_id: int,
    change_quantity: int,
    staff_user_id: int,
    action_type: str,
    reason: str,
    order_id: int | None = None,
    note: str | None = None,
) -> dict | None:
    rows = call_sp(
        'sp_AdjustVariantStock',
        [variant_id, change_quantity, staff_user_id, action_type, reason, order_id, note],
    )
    return rows[0] if rows else None


def recommendation_performance(from_date=None, to_date=None) -> dict:
    rows = call_sp('sp_ReportRecommendationPerformance', [from_date, to_date])
    if not rows:
        return {'impressions': 0, 'clicks': 0, 'ctr_percent': 0, 'conversions': 0}
    row = rows[0]
    row['impressions'] = row.get('impressions') or 0
    row['clicks'] = row.get('clicks') or 0
    row['ctr_percent'] = row.get('ctr_percent') or 0
    row.setdefault('conversions', 0)
    return row


def generate_customer_recommendations(customer_id: int, top_n=10, cold_start_threshold=5) -> list[dict]:
    return call_sp('sp_GenerateCustomerRecommendations', [customer_id, top_n, cold_start_threshold])


def run_recommendation_batch(top_n=10, cold_start_threshold=5) -> dict:
    rows = call_sp('sp_RunRecommendationBatch', [top_n, cold_start_threshold])
    return rows[0] if rows else {'generated': 0}
