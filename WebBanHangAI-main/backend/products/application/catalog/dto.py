from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


def _getlist(source: Any, key: str) -> list[str]:
    if hasattr(source, 'getlist'):
        return [str(item) for item in source.getlist(key) if str(item).strip()]
    value = source.get(key) if hasattr(source, 'get') else None
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(item) for item in value if str(item).strip()]
    return [str(value)] if str(value).strip() else []


@dataclass(frozen=True)
class ProductListQueryDTO:
    category: str | None = None
    gender: str | None = None
    search: str | None = None
    subcategories: list[str] = field(default_factory=list)
    brand: str | None = None
    size: str | None = None
    color: str | None = None
    tags: list[str] = field(default_factory=list)
    rating: str | None = None
    in_stock: str | None = None
    min_price: str | None = None
    max_price: str | None = None
    sort: str | None = None
    is_new: str | None = None
    is_sale: str | None = None
    include_unisex: str | None = None
    page: str | None = None
    page_size: str | None = None
    session_id: str | None = None

    @classmethod
    def from_query_params(cls, params: Any) -> 'ProductListQueryDTO':
        return cls(
            category=params.get('category'),
            gender=params.get('gender'),
            search=params.get('search'),
            subcategories=_getlist(params, 'subcategory'),
            brand=params.get('brand'),
            size=params.get('size'),
            color=params.get('color'),
            tags=_getlist(params, 'tag'),
            rating=params.get('rating'),
            in_stock=params.get('in_stock'),
            min_price=params.get('minPrice'),
            max_price=params.get('maxPrice'),
            sort=params.get('sort'),
            is_new=params.get('new'),
            is_sale=params.get('sale'),
            include_unisex=params.get('include_unisex'),
            page=params.get('page'),
            page_size=params.get('page_size'),
            session_id=params.get('session_id'),
        )

    def as_legacy_query_params(self) -> dict[str, str | list[str]]:
        params: dict[str, str | list[str]] = {}
        scalar_values = {
            'category': self.category,
            'gender': self.gender,
            'search': self.search,
            'brand': self.brand,
            'size': self.size,
            'color': self.color,
            'rating': self.rating,
            'in_stock': self.in_stock,
            'minPrice': self.min_price,
            'maxPrice': self.max_price,
            'sort': self.sort,
            'new': self.is_new,
            'sale': self.is_sale,
            'include_unisex': self.include_unisex,
            'page': self.page,
            'page_size': self.page_size,
            'session_id': self.session_id,
        }
        for key, value in scalar_values.items():
            if value not in (None, ''):
                params[key] = value
        if self.subcategories:
            params['subcategory'] = self.subcategories
        if self.tags:
            params['tag'] = self.tags
        return params
