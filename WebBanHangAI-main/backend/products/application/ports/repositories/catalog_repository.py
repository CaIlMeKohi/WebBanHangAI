from __future__ import annotations

from typing import Any, Protocol

from products.application.catalog.dto import ProductListQueryDTO


class CatalogRepository(Protocol):
    def list_products(self, filters: ProductListQueryDTO) -> Any:
        ...

    def get_product_detail(self, product_id: str | int) -> Any:
        ...

    def list_categories(self) -> Any:
        ...

    def list_brands(self) -> Any:
        ...

    def list_admin_categories(self) -> Any:
        ...

    def list_admin_brands(self) -> Any:
        ...

    def category_has_products(self, category: Any) -> bool:
        ...

    def deactivate_category(self, category: Any) -> Any:
        ...
