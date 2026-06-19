from __future__ import annotations

from django.db.models import Q, QuerySet

from products.models import Category, Product


def active_products_queryset() -> QuerySet[Product]:
    return (
        Product.objects.filter(status='active')
        .select_related('category', 'brand')
        .prefetch_related('images', 'variants', 'category__children')
    )


def apply_catalog_filters(queryset: QuerySet[Product], params) -> QuerySet[Product]:
    category = params.get('category')
    gender = params.get('gender')
    search = params.get('search')
    subcategories = params.getlist('subcategory')
    brand = params.get('brand')
    size = params.get('size')
    color = params.get('color')
    tags = params.getlist('tag')
    rating = params.get('rating')
    in_stock = params.get('in_stock')
    min_price = params.get('minPrice')
    max_price = params.get('maxPrice')
    sort = params.get('sort')

    if category in {'men', 'women'} and not gender:
        gender = category
        category = None

    if gender in {'men', 'women', 'unisex'}:
        gender_filter = Q(gender=gender)
        if gender in {'men', 'women'} and params.get('include_unisex', 'true') in {'true', '1'}:
            gender_filter |= Q(gender='unisex')
        queryset = queryset.filter(gender_filter)
    if category:
        category_slugs = _category_slug_with_descendants(category)
        queryset = queryset.filter(category__slug__in=category_slugs or [category])
    if params.get('new') in {'true', '1'}:
        queryset = queryset.filter(is_new=True)
    if params.get('sale') in {'true', '1'}:
        queryset = queryset.none()
    if search:
        queryset = queryset.filter(
            Q(name__icontains=search)
            | Q(description__icontains=search)
            | Q(feature_text__icontains=search)
            | Q(brand__name__icontains=search)
        )
    if subcategories:
        queryset = queryset.filter(category__slug__in=subcategories)
    if brand:
        brand_filter = Q(brand__slug=brand)
        if str(brand).isdigit():
            brand_filter |= Q(brand_id=int(brand))
        queryset = queryset.filter(brand_filter)
    if size:
        queryset = queryset.filter(variants__size=size, variants__is_active=True)
    if color:
        queryset = queryset.filter(variants__color=color, variants__is_active=True)
    for tag in tags:
        queryset = queryset.filter(tags__icontains=tag.strip().lower())
    if rating:
        queryset = queryset.filter(average_rating__gte=rating)
    if in_stock in {'true', '1'}:
        queryset = queryset.filter(variants__stock_quantity__gt=0)
    if min_price:
        queryset = queryset.filter(base_price__gte=min_price)
    if max_price:
        queryset = queryset.filter(base_price__lte=max_price)

    if sort == 'price_asc':
        queryset = queryset.order_by('base_price')
    elif sort == 'price_desc':
        queryset = queryset.order_by('-base_price')
    elif sort == 'newest':
        queryset = queryset.order_by('-created_at')
    else:
        queryset = queryset.order_by('-is_bestseller', '-is_new', '-created_at', '-product_id')

    return queryset.distinct()


def _category_slug_with_descendants(slug: str) -> list[str]:
    categories = list(Category.objects.filter(is_active=True).values('category_id', 'parent_id', 'slug'))
    children_by_parent: dict[int | None, list[dict]] = {}
    for item in categories:
        children_by_parent.setdefault(item['parent_id'], []).append(item)

    start = next((item for item in categories if item['slug'] == slug), None)
    if not start:
        return []

    result: list[str] = []
    stack = [start]
    while stack:
        current = stack.pop()
        result.append(current['slug'])
        stack.extend(children_by_parent.get(current['category_id'], []))
    return result
