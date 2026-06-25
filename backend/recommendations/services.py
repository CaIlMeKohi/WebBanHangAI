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
    search_term_recency = {}
    search_term_bucket = {}
    product_interaction_count = Counter()
    product_recency = {}
    product_bucket = {}
    category_recency = {}
    category_bucket = {}
    interaction_count = 0
    latest_viewed_product_id = None
    latest_viewed_category_slug = None
    latest_viewed_brand_id = None
    now = timezone.now()

    for event_index, event in enumerate(events):
        interaction_count += 1
        recency = 300 - event_index
        age_days = (now - event.timestamp).total_seconds() / 86400
        if age_days <= 2:
            timeline_bucket = 0
        elif age_days <= 14:
            timeline_bucket = 1
        else:
            timeline_bucket = 2
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
        category_recency.setdefault(event.product.category.slug, recency)
        category_bucket.setdefault(event.product.category.slug, timeline_bucket)
        if event.product.brand_id:
            brand_counter[event.product.brand_id] += weight
        product_counter[event.product_id] += weight
        product_interaction_count[event.product_id] += 1
        product_recency.setdefault(event.product_id, recency)
        product_bucket.setdefault(event.product_id, timeline_bucket)
        if event.interaction_type == 'search' and event.search_query:
            for term in event.search_query.lower().split():
                if len(term) >= 2:
                    search_terms[term] += weight
                    search_term_recency.setdefault(term, recency)
                    search_term_bucket.setdefault(term, timeline_bucket)

    return {
        'categories': category_counter,
        'products': product_counter,
        'brands': brand_counter,
        'search_terms': search_terms,
        'search_term_recency': search_term_recency,
        'search_term_bucket': search_term_bucket,
        'product_interaction_count': product_interaction_count,
        'product_recency': product_recency,
        'product_bucket': product_bucket,
        'category_recency': category_recency,
        'category_bucket': category_bucket,
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

    preferences = _collect_user_preferences(customer_id, session_id)

    # If a search query is provided, boost search terms in preferences so
    # matching products are prioritized for the "for you" recommendations.
    if search:
        for term in [t for t in search.lower().split() if len(t) >= 2]:
            preferences['search_terms'][term] += 6
            preferences['search_term_recency'][term] = 1000
            preferences['search_term_bucket'][term] = 0

    available_variants = ProductVariant.objects.filter(
        product_id=OuterRef('pk'),
        is_active=True,
        stock_quantity__gt=F('stock_reserved'),
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

    scored_by_bucket = {0: [], 1: [], 2: [], 3: []}
    for product in products:
        searchable_text = f'{product.name} {product.feature_text} {product.tags}'.lower()
        matching_terms = [
            term for term in preferences['search_terms']
            if term in searchable_text
        ]
        search_recency = max(
            (preferences['search_term_recency'][term] for term in matching_terms),
            default=0,
        )
        search_bucket = min(
            (preferences['search_term_bucket'][term] for term in matching_terms),
            default=None,
        )
        direct_recency = preferences['product_recency'].get(product.product_id, 0)
        direct_bucket = preferences['product_bucket'].get(product.product_id)
        category_interest = preferences['categories'][product.category.slug]
        category_recency = preferences['category_recency'].get(product.category.slug, 0)
        product_category_bucket = preferences['category_bucket'].get(product.category.slug)
        search_interest = sum(preferences['search_terms'][term] for term in matching_terms)
        brand_interest = preferences['brands'][product.brand_id]

        popularity = 0
        if product.is_bestseller:
            popularity += 4
        popularity += min(product.sold_count, 100) / 25
        popularity += min(product.view_count, 500) / 100
        if product.is_new:
            popularity += 1.5
        popularity += int(float(product.average_rating) * 3)

        bucket_candidates = [
            item for item in [direct_bucket, search_bucket, product_category_bucket]
            if item is not None
        ]
        timeline_bucket = min(bucket_candidates) if bucket_candidates else 3
        score = (
            max(direct_recency, search_recency) * 2
            + preferences['products'][product.product_id] * 80
            + preferences['product_interaction_count'][product.product_id] * 25
            + search_interest * 45
            + category_interest * 10
            + category_recency * 0.35
            + brand_interest * 6
            + popularity
        )
        scored_by_bucket[timeline_bucket].append((score, product.product_id))

    for bucket_items in scored_by_bucket.values():
        bucket_items.sort(key=lambda item: item[0], reverse=True)

    picked_ids = []
    seen_ids = set()

    def take_from_bucket(bucket: int, count: int) -> None:
        for _, product_id in scored_by_bucket[bucket]:
            if len(picked_ids) >= limit:
                return
            if product_id in seen_ids:
                continue
            picked_ids.append(product_id)
            seen_ids.add(product_id)
            count -= 1
            if count <= 0:
                return

    # TikTok Shop-like timeline: keep recent intent dominant, while reserving
    # space for previous and older interests instead of letting one fresh topic
    # consume the whole feed.
    quotas = {
        0: max(1, int(limit * 0.45)),
        1: max(1, int(limit * 0.25)),
        2: max(1, int(limit * 0.15)),
        3: limit,
    }
    for bucket in [0, 1, 2, 3]:
        take_from_bucket(bucket, quotas[bucket])

    if len(picked_ids) < limit:
        for bucket in [0, 1, 2, 3]:
            take_from_bucket(bucket, limit - len(picked_ids))

    # Preserve scored order for queryset output.
    return _hydrated_products(picked_ids[:limit])


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
