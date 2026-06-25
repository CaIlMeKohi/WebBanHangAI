from __future__ import annotations

from django.db import DatabaseError, connection, models

from products.models import Payment, PaymentMethod, RecommendationConfig


def _table_exists(table_name):
    try:
        return table_name in connection.introspection.table_names()
    except DatabaseError:
        return False


class DjangoOrmAdminConfigRepository:
    payment_method_defaults = [
        {'method_id': 1, 'code': 'cod', 'name': 'Thanh toan khi nhan hang', 'is_active': True, 'config': {}, 'source': 'payments.method'},
        {'method_id': 2, 'code': 'vnpay', 'name': 'VNPay', 'is_active': True, 'config': {}, 'source': 'payments.method'},
        {'method_id': 3, 'code': 'momo', 'name': 'MoMo', 'is_active': True, 'config': {}, 'source': 'payments.method'},
        {'method_id': 4, 'code': 'bank_transfer', 'name': 'Chuyen khoan ngan hang', 'is_active': True, 'config': {}, 'source': 'payments.method'},
        {'method_id': 5, 'code': 'payos', 'name': 'payOS', 'is_active': True, 'config': {}, 'source': 'payments.method'},
    ]

    def payment_methods_table_exists(self) -> bool:
        return _table_exists('payment_methods')

    def payment_methods_queryset(self):
        if not self.payment_methods_table_exists():
            return PaymentMethod.objects.none()
        for item in self.payment_method_defaults:
            PaymentMethod.objects.get_or_create(
                code=item['code'],
                defaults={'name': item['name'], 'is_active': item['is_active'], 'config': item['config']},
            )
        return PaymentMethod.objects.all().order_by('code')

    def payment_method_fallback_rows(self):
        usage = {
            row['payment_method']: row['count']
            for row in Payment.objects.values('payment_method').annotate(count=models.Count('payment_id'))
        }
        return [{**item, 'usage_count': usage.get(item['code'], 0)} for item in self.payment_method_defaults]

    def recommendation_configs_table_exists(self) -> bool:
        return _table_exists('recommendation_configs')

    def recommendation_configs_queryset(self):
        if not self.recommendation_configs_table_exists():
            return RecommendationConfig.objects.none()
        return RecommendationConfig.objects.all().order_by('config_key')
