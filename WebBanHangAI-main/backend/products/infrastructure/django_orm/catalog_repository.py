from __future__ import annotations

from django.db.models import Avg, Count, Q
from django.http import QueryDict

from products.application.catalog.dto import ProductListQueryDTO
from products.application.catalog_queries import active_products_queryset, apply_catalog_filters
from products.models import Brand, Category, Product


class DjangoOrmCatalogRepository:
    def list_products(self, filters: ProductListQueryDTO):
        queryset = active_products_queryset()
        return apply_catalog_filters(queryset, self._to_query_dict(filters))

    def get_product_detail(self, product_id: str | int):
        return (
            Product.objects.filter(status='active')
            .annotate(
                approved_review_count=Count(
                    'reviews',
                    filter=Q(reviews__status='approved'),
                    distinct=True,
                ),
                approved_average_rating=Avg(
                    'reviews__rating',
                    filter=Q(reviews__status='approved'),
                ),
            )
            .select_related('category', 'brand')
            .prefetch_related('images', 'variants', 'category__children')
            .get(product_id=product_id)
        )

    def list_categories(self):
        return (
            Category.objects.filter(parent__isnull=True, is_active=True)
            .prefetch_related(
                'children',
                'children__children',
                'children__children__products',
                'children__products',
                'products',
            )
            .order_by('name')
        )

    def list_brands(self):
        return Brand.objects.filter(is_active=True).order_by('name')

    def list_admin_categories(self):
        return Category.objects.all().order_by('name')

    def list_admin_brands(self):
        return Brand.objects.all().order_by('name')

    def category_has_products(self, category):
        category_ids = self._category_ids_with_descendants(category)
        return Product.objects.filter(category_id__in=category_ids).exists()

    def deactivate_category(self, category):
        category.is_active = False
        category.save(update_fields=['is_active'])
        return category

    def _to_query_dict(self, filters: ProductListQueryDTO) -> QueryDict:
        query = QueryDict('', mutable=True)
        for key, value in filters.as_legacy_query_params().items():
            if isinstance(value, list):
                query.setlist(key, value)
            else:
                query[key] = value
        return query

    def _category_ids_with_descendants(self, category) -> list[int]:
        category_ids = [category.category_id]
        for child in category.children.all():
            category_ids.extend(self._category_ids_with_descendants(child))
        return category_ids
