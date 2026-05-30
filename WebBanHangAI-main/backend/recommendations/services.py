from collections import Counter

from django.db import DatabaseError
from django.db.models import Count

from products.models import PrecomputedRecommendation, Product, UserInteraction


def _hydrated_products(product_ids: list[int]) -> list[Product]:
    if not product_ids:
        return []

    queryset = (
        Product.objects.filter(product_id__in=product_ids, status='active')
        .select_related('brand', 'category', 'category__parent')
        .prefetch_related('images', 'variants')
        .annotate(interaction_count=Count('interactions', distinct=True))
    )
    return sorted(queryset, key=lambda product: product_ids.index(product.product_id))


def _collect_user_preferences(user_id: int | None, session_id: str | None) -> dict:
    events = UserInteraction.objects.select_related('product', 'product__category')
    if user_id is not None:
        events = events.filter(user_id=user_id)
    elif session_id:
        events = events.filter(session_id=session_id)
    else:
        events = events.none()

    events = events[:300]
    category_counter = Counter()
    product_counter = Counter()
    brand_counter = Counter()
    interaction_count = 0

    for event in events:
        interaction_count += 1
        weight = float(event.score or 1)
        if event.interaction_type == 'search':
            weight = 0.5
        elif event.interaction_type == 'view':
            weight = 1.0
        if event.interaction_type == 'wishlist_add':
            weight = 2.5
        elif event.interaction_type == 'add_to_cart':
            weight = 3.0
        elif event.interaction_type == 'purchase':
            weight = 5.0

        category_counter[event.product.category.slug] += weight
        if event.product.brand_id:
            brand_counter[event.product.brand_id] += weight
        product_counter[event.product_id] += weight

    return {
        'categories': category_counter,
        'products': product_counter,
        'brands': brand_counter,
        'interaction_count': interaction_count,
    }


def _parse_user(user_id: str | None) -> int | None:
    if user_id is None:
        return None
    try:
        return int(user_id)
    except ValueError:
        return None


def _precomputed_recommendations(user_id: int | None, session_id: str | None, limit: int) -> list[Product]:
    records = PrecomputedRecommendation.objects.select_related('product')
    if user_id is not None:
        records = records.filter(user_id=user_id)
    elif session_id:
        return []
    else:
        return []

    try:
        records = records.order_by('rank', '-score')[:limit]
        return _hydrated_products([record.product_id for record in records])
    except DatabaseError:
        # Some existing SQL Server databases were created from an older report schema
        # where precomputed_recommendations has different column names. Keep the public
        # recommendation API alive by falling back to on-the-fly recommendations.
        return []


def get_for_you_recommendations(user_id: str | None, session_id: str | None = None, limit: int = 8) -> list[Product]:
    parsed_user_id = _parse_user(user_id)
    precomputed = _precomputed_recommendations(parsed_user_id, session_id, limit)
    if precomputed:
        return precomputed

    preferences = _collect_user_preferences(parsed_user_id, session_id)

    products = list(Product.objects.filter(status='active').select_related('category', 'brand').prefetch_related('interactions'))

    if not products:
        return []

    if preferences['interaction_count'] < 5:
        cold_start = sorted(
            products,
            key=lambda product: (
                product.is_bestseller,
                product.sold_count,
                float(product.average_rating),
                product.view_count,
                product.is_new,
            ),
            reverse=True,
        )
        return _hydrated_products([product.product_id for product in cold_start[:limit]])

    scored = []
    for product in products:
        score = 0

        score += preferences['categories'][product.category.slug] * 3
        score += preferences['brands'][product.brand_id] * 2
        score += preferences['products'][product.product_id] * 4

        if product.is_bestseller:
            score += 4
        score += min(product.sold_count, 100) / 25
        score += min(product.view_count, 500) / 100
        if product.is_new:
            score += 1.5
        score += int(float(product.average_rating) * 3)

        scored.append((score, product.product_id))

    scored.sort(key=lambda item: item[0], reverse=True)
    picked_ids = [product_id for _, product_id in scored[:limit]]

    # Preserve scored order for queryset output.
    return _hydrated_products(picked_ids)


def get_related_products(product_id: str, limit: int = 4) -> list[Product]:
    try:
        product = Product.objects.select_related('category').get(product_id=product_id)
    except Product.DoesNotExist:
        return []

    same_category = Product.objects.filter(category=product.category, status='active').exclude(product_id=product.product_id)
    sale_candidates = Product.objects.filter(category=product.category, is_bestseller=True, status='active').exclude(product_id=product.product_id)

    related = list(sale_candidates[:limit])
    if len(related) < limit:
        existing = {item.product_id for item in related}
        for candidate in same_category:
            if candidate.product_id not in existing:
                related.append(candidate)
            if len(related) >= limit:
                break

    ordered_ids = [item.product_id for item in related]
    return _hydrated_products(ordered_ids)
