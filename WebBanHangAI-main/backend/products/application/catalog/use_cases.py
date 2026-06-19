from __future__ import annotations

from products.application.catalog.dto import ProductListQueryDTO
from products.application.ports.repositories.catalog_repository import CatalogRepository


class ListProductsUseCase:
    def __init__(self, repository: CatalogRepository):
        self.repository = repository

    def execute(self, filters: ProductListQueryDTO):
        return self.repository.list_products(filters)


class GetProductDetailUseCase:
    def __init__(self, repository: CatalogRepository):
        self.repository = repository

    def execute(self, product_id: str | int):
        return self.repository.get_product_detail(product_id)


class ListCategoriesUseCase:
    def __init__(self, repository: CatalogRepository):
        self.repository = repository

    def execute(self):
        return self.repository.list_categories()


class ListBrandsUseCase:
    def __init__(self, repository: CatalogRepository):
        self.repository = repository

    def execute(self):
        return self.repository.list_brands()


class ListAdminCategoriesUseCase:
    def __init__(self, repository: CatalogRepository):
        self.repository = repository

    def execute(self):
        return self.repository.list_admin_categories()


class ListAdminBrandsUseCase:
    def __init__(self, repository: CatalogRepository):
        self.repository = repository

    def execute(self):
        return self.repository.list_admin_brands()


class DeleteCategoryUseCase:
    def __init__(self, repository: CatalogRepository):
        self.repository = repository

    def execute(self, category):
        if self.repository.category_has_products(category):
            return self.repository.deactivate_category(category), 'deactivated'
        return category, 'delete'
