from collections import Counter

from django.db import DatabaseError
from django.db.models import Count, Exists, F, Max, OuterRef
from django.utils import timezone

from products.models import Customer, PrecomputedRecommendation, Product, ProductVariant, UserInteraction


def _hydrated_products(product_ids: list[int]) -> list[Product]:
    if not product_ids:
        return []

    queryset = (
        Product.objects.filter(
            product_id__in=product_ids,
            status='active',
            variants__is_active=True,
            variants__stock_quantity__gt=F('variants__stock_reserved'),
        )
        .distinct()
        .select_related('brand', 'category', 'category__parent')
        .prefetch_related('images', 'variants')
        .annotate(interaction_count=Count('interactions', distinct=True))
    )
    return sorted(queryset, key=lambda product: product_ids.index(product.product_id))


def _collect_user_preferences(customer_id: int | None, session_id: str | None) -> dict:
    events = UserInteraction.objects.select_related('product', 'product__category')
    if customer_id is not None:
        events = events.filter(user_id=customer_id)
    elif session_id:
        events = events.filter(session_id=session_id)
    else:
        events = events.none()

    events = events.order_by('-timestamp')[:300]
    category_counter = Counter()
    product_counter = Counter()
    brand_counter = Counter()
    search_terms = Counter()
    interaction_count = 0
    latest_viewed_product_id = None
    latest_viewed_category_slug = None
    latest_viewed_brand_id = None

    for event in events:
        interaction_count += 1
        weight = float(event.score or 1)
        if event.interaction_type == 'search':
            weight = 0.5
        elif event.interaction_type == 'view':
            weight = 1.0
            if latest_viewed_product_id is None:
                latest_viewed_product_id = event.product_id
                latest_viewed_category_slug = event.product.category.slug
                latest_viewed_brand_id = event.product.brand_id
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
        if event.interaction_type == 'search' and event.search_query:
            for term in event.search_query.lower().split():
                if len(term) >= 2:
                    search_terms[term] += weight

    return {
        'categories': category_counter,
        'products': product_counter,
        'brands': brand_counter,
        'search_terms': search_terms,
        'interaction_count': interaction_count,
        'latest_viewed_product_id': latest_viewed_product_id,
        'latest_viewed_category_slug': latest_viewed_category_slug,
        'latest_viewed_brand_id': latest_viewed_brand_id,
    }


def _parse_user(user_id: str | None) -> int | None:
    if user_id is None:
        return None
    try:
        return int(user_id)
    except ValueError:
        return None


def _precomputed_recommendations(customer_id: int | None, session_id: str | None, limit: int) -> list[Product]:
    records = PrecomputedRecommendation.objects.select_related('product')
    if customer_id is not None:
        records = records.filter(user_id=customer_id)
    elif session_id:
        return []
    else:
        return []

    try:
        records = records.filter(expires_at__gt=timezone.now())
        generated_at = records.aggregate(latest=Max('generated_at'))['latest']
        latest_interaction = UserInteraction.objects.filter(user_id=customer_id).aggregate(latest=Max('timestamp'))['latest']
        if latest_interaction and (generated_at is None or latest_interaction > generated_at):
            return []
        records = records.order_by('rank', '-score')[:limit]
        return _hydrated_products([record.product_id for record in records])
    except DatabaseError:
        # Some existing SQL Server databases were created from an older report schema
        # where precomputed_recommendations has different column names. Keep the public
        # recommendation API alive by falling back to on-the-fly recommendations.
        return []


def get_for_you_recommendations(user_id: str | None, session_id: str | None = None, limit: int = 8, search: str | None = None) -> list[Product]:
    parsed_user_id = _parse_user(user_id)
    customer_id = Customer.objects.filter(user_id=parsed_user_id).values_list('customer_id', flat=True).first()
    search = (search or '').strip()
    precomputed = [] if search else _precomputed_recommendations(customer_id, session_id, limit)
    if precomputed:
        return precomputed

    preferences = _collect_user_preferences(customer_id, session_id)

    # If a search query is provided, boost search terms in preferences so
    # matching products are prioritized for the "for you" recommendations.
    if search:
        for term in [t for t in search.lower().split() if len(t) >= 2]:
            preferences['search_terms'][term] += 6

    available_variants = ProductVariant.objects.filter(
        product_id=OuterRef('pk'),
        is_active=True,
        stock_quantity__gt=F('stock_reserved'),
    )
    purchased_products = set()
    if customer_id is not None:
        purchased_products = set(
            Product.objects.filter(
                order_items__order__user_id=customer_id,
                order_items__order__status__in=['confirmed', 'processing', 'shipped', 'delivered'],
            ).values_list('product_id', flat=True)
        )
    products = list(
        Product.objects.filter(status='active')
        .annotate(has_available_variant=Exists(available_variants))
        .filter(has_available_variant=True)
        .select_related('category', 'brand')
        .prefetch_related('interactions')
    )

    if not products:
        return []

    if preferences['interaction_count'] == 0 and not preferences['search_terms']:
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

    eligible_products = [
        product for product in products
        if product.product_id not in purchased_products
    ] or products

    scored = []
    for product in eligible_products:
        score = 0

        score += preferences['categories'][product.category.slug] * 3
        score += preferences['brands'][product.brand_id] * 2
        score += preferences['products'][product.product_id] * 4
        if product.category.slug == preferences['latest_viewed_category_slug']:
            score += 40
        if product.brand_id == preferences['latest_viewed_brand_id']:
            score += 12
        if product.product_id == preferences['latest_viewed_product_id']:
            score -= 100
        searchable_text = f'{product.name} {product.feature_text} {product.tags}'.lower()
        score += sum(weight * 8 for term, weight in preferences['search_terms'].items() if term in searchable_text)

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
    if len(picked_ids) < limit:
        picked_ids.extend(
            product.product_id
            for product in eligible_products
            if product.product_id not in picked_ids
        )

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
