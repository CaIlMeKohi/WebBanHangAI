from __future__ import annotations

from products.application.inventory.dto import AdjustStockDTO
from products.application.ports.repositories.inventory_repository import InventoryRepository


class AdjustVariantStockUseCase:
    def __init__(self, repository: InventoryRepository):
        self.repository = repository

    def execute(self, actor, dto: AdjustStockDTO):
        return self.repository.adjust_variant_stock(actor, dto)


class ListLowStockUseCase:
    def __init__(self, repository: InventoryRepository):
        self.repository = repository

    def execute(self):
        return self.repository.list_low_stock()


class ListStockVariantsUseCase:
    def __init__(self, repository: InventoryRepository):
        self.repository = repository

    def execute(self):
        return self.repository.list_stock_variants()
