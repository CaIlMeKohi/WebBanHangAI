from django.core.management.base import BaseCommand

from products.models import Category, Product, ProductImage, ProductTag, ProductVariant, Tag, UserInteraction, Brand
from products.seed_data import SEED_BRANDS, SEED_CATEGORIES, SEED_INTERACTIONS, SEED_PRODUCTS


class Command(BaseCommand):
    help = 'Seed products table with starter data.'

    def handle(self, *args, **options):
        categories_by_slug: dict[str, Category] = {}
        for item in SEED_CATEGORIES:
            parent_slug = item.get('parent_slug')
            parent = categories_by_slug.get(parent_slug) if parent_slug else None
            category, _ = Category.objects.update_or_create(
                slug=item['slug'],
                defaults={
                    'name': item['name'],
                    'description': item.get('description', ''),
                    'parent': parent,
                },
            )
            categories_by_slug[item['slug']] = category

        brands_by_name: dict[str, Brand] = {}
        for item in SEED_BRANDS:
            brand, _ = Brand.objects.update_or_create(
                name=item['name'],
                defaults={
                    'logo_url': item.get('logo_url', ''),
                    'description': item.get('description', ''),
                },
            )
            brands_by_name[item['name']] = brand

        created = 0
        updated = 0
        product_by_slug: dict[str, Product] = {}

        for item in SEED_PRODUCTS:
            category = categories_by_slug[item['category_slug']]
            brand = brands_by_name[item['brand_name']]

            product, is_created = Product.objects.update_or_create(
                slug=item['slug'],
                defaults={
                    'name': item['name'],
                    'description': item['description'],
                    'price': item['price'],
                    'sale_price': item['sale_price'],
                    'stock_quantity': item['stock_quantity'],
                    'brand': brand,
                    'category': category,
                    'average_rating': item['average_rating'],
                    'num_reviews': item['num_reviews'],
                    'feature_text': item['feature_text'],
                    'is_active': item['is_active'],
                    'is_new': item.get('is_new', False),
                },
            )
            product_by_slug[item['slug']] = product

            ProductImage.objects.update_or_create(
                product=product,
                image_url=item['image_url'],
                defaults={'is_primary': True},
            )

            existing_variant_ids = set()
            for variant in item['variants']:
                variant_obj, _ = ProductVariant.objects.update_or_create(
                    sku=variant['sku'],
                    defaults={
                        'product': product,
                        'variant_attributes': variant['variant_attributes'],
                        'price': variant['price'],
                        'stock_quantity': variant['stock_quantity'],
                    },
                )
                existing_variant_ids.add(variant_obj.variant_id)

            ProductVariant.objects.filter(product=product).exclude(variant_id__in=existing_variant_ids).delete()

            ProductTag.objects.filter(product=product).delete()
            for tag_name in item['tags']:
                tag, _ = Tag.objects.get_or_create(name=tag_name)
                ProductTag.objects.get_or_create(product=product, tag=tag)

            if is_created:
                created += 1
            else:
                updated += 1

        UserInteraction.objects.filter(session_id='guest-demo').delete()
        for interaction in SEED_INTERACTIONS:
            product = product_by_slug.get(interaction['product_slug'])
            if product is None:
                continue
            UserInteraction.objects.create(
                user_id=interaction['user_id'],
                session_id=interaction['session_id'],
                product=product,
                interaction_type=interaction['interaction_type'],
                score=interaction['score'],
            )

        self.stdout.write(self.style.SUCCESS(f'Seed complete: created={created}, updated={updated}'))
