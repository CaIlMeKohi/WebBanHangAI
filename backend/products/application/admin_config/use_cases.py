from __future__ import annotations

from products.application.ports.repositories.admin_config_repository import AdminConfigRepository


class PaymentMethodsQueryUseCase:
    def __init__(self, repository: AdminConfigRepository):
        self.repository = repository

    def queryset(self):
        return self.repository.payment_methods_queryset()

    def fallback_rows(self):
        return self.repository.payment_method_fallback_rows()

    def table_exists(self) -> bool:
        return self.repository.payment_methods_table_exists()


class RecommendationConfigsQueryUseCase:
    def __init__(self, repository: AdminConfigRepository):
        self.repository = repository

    def queryset(self):
        return self.repository.recommendation_configs_queryset()

    def table_exists(self) -> bool:
        return self.repository.recommendation_configs_table_exists()
