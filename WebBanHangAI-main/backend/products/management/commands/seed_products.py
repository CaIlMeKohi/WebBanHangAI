from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand
from django.utils import timezone

from products.models import Address, Brand, Category, Customer, Product, ProductImage, ProductVariant, StoreUser, UserInteraction


SEED_CATEGORIES = [
    {"slug": "women", "name": "Thoi Trang Nu", "description": "San pham cho nu"},
    {"slug": "men", "name": "Thoi Trang Nam", "description": "San pham cho nam"},
    {"slug": "unisex", "name": "Thoi Trang Unisex", "description": "San pham unisex"},
    {"slug": "ao-len", "name": "Ao Len", "description": "Ao len va cardigan", "parent_slug": "women"},
    {"slug": "ao-khoac", "name": "Ao Khoac", "description": "Khoac ngoai", "parent_slug": "women"},
    {"slug": "vay", "name": "Vay", "description": "Dam va vay", "parent_slug": "women"},
    {"slug": "ao-so-mi", "name": "Ao So Mi", "description": "So mi casual va formal", "parent_slug": "men"},
    {"slug": "quan-tay", "name": "Quan Tay", "description": "Quan tay cong so", "parent_slug": "men"},
    {"slug": "ao-thun", "name": "Ao Thun", "description": "Ao thun co ban", "parent_slug": "unisex"},
    {"slug": "quan", "name": "Quan", "description": "Quan jean va quan tay", "parent_slug": "unisex"},
    {"slug": "giay", "name": "Giay", "description": "Sneaker va giay thoi trang", "parent_slug": "unisex"},
]

SEED_BRANDS = [
    {"slug": "essence-basics", "name": "Essence Basics", "logo_url": "", "description": "Brand noi bo cho san pham co ban"},
    {"slug": "essence-studio", "name": "Essence Studio", "logo_url": "", "description": "Dong san pham premium"},
]

SEED_PRODUCTS = [
    {
        "slug": "ao-thun-trang-classic",
        "name": "Ao Thun Trang Classic",
        "short_description": "Ao thun cotton toi gian",
        "description": "Ao thun thiet yeu vuot thoi gian duoc lam tu cotton cao cap.",
        "base_price": 299000,
        "brand_slug": "essence-basics",
        "category_slug": "ao-thun",
        "average_rating": 4.8,
        "review_count": 342,
        "sold_count": 26,
        "view_count": 180,
        "feature_text": "cotton trang toi gian basic unisex",
        "status": "active",
        "is_new": False,
        "is_bestseller": True,
        "image_url": "https://images.unsplash.com/photo-1618677603544-51162346e165?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        "variants": [
            {"sku": "TS-WHT-S", "color": "Trang", "size": "S", "price": 299000, "stock_quantity": 20},
            {"sku": "TS-WHT-M", "color": "Trang", "size": "M", "price": 299000, "stock_quantity": 25},
            {"sku": "TS-BLK-M", "color": "Den", "size": "M", "price": 299000, "stock_quantity": 25},
        ],
        "tags": ["best-seller", "trending"],
    },
    {
        "slug": "ao-len-cashmere",
        "name": "Ao Len Cashmere",
        "short_description": "Len cashmere cao cap cho nu",
        "description": "Ao len cashmere mem mai sang trong voi thiet ke hien dai.",
        "base_price": 899000,
        "brand_slug": "essence-studio",
        "category_slug": "ao-len",
        "average_rating": 4.9,
        "review_count": 189,
        "sold_count": 14,
        "view_count": 120,
        "feature_text": "cashmere len am ap premium nu",
        "status": "active",
        "is_new": True,
        "is_bestseller": False,
        "image_url": "https://images.unsplash.com/photo-1759873821397-433b7ea0eb7c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        "variants": [
            {"sku": "SW-BE-S", "color": "Be", "size": "S", "price": 899000, "stock_quantity": 10},
            {"sku": "SW-CREAM-M", "color": "Kem", "size": "M", "price": 899000, "stock_quantity": 14},
            {"sku": "SW-BLK-L", "color": "Den", "size": "L", "price": 899000, "stock_quantity": 8},
        ],
        "tags": ["trending", "sale"],
    },
    {
        "slug": "quan-jean-den-slim-fit",
        "name": "Quan Jean Den Slim Fit",
        "short_description": "Jean slim fit unisex",
        "description": "Vai denim cao cap co do co gian thoai mai.",
        "base_price": 799000,
        "brand_slug": "essence-basics",
        "category_slug": "quan",
        "average_rating": 4.7,
        "review_count": 456,
        "sold_count": 34,
        "view_count": 190,
        "feature_text": "denim den slim fit jean unisex",
        "status": "active",
        "is_new": False,
        "is_bestseller": True,
        "image_url": "https://images.unsplash.com/photo-1744383390068-abfc7bc7fd07?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        "variants": [
            {"sku": "JE-BLK-30", "color": "Den", "size": "30", "price": 799000, "stock_quantity": 22},
            {"sku": "JE-BLK-32", "color": "Den", "size": "32", "price": 799000, "stock_quantity": 24},
            {"sku": "JE-BLU-34", "color": "Xanh dam", "size": "34", "price": 799000, "stock_quantity": 17},
        ],
        "tags": ["best-seller"],
    },
    {
        "slug": "ao-khoac-da-len",
        "name": "Ao Khoac Da Len",
        "short_description": "Ao khoac da len premium",
        "description": "Ao khoac len sang trong voi thiet ke co dien.",
        "base_price": 2499000,
        "brand_slug": "essence-studio",
        "category_slug": "ao-khoac",
        "average_rating": 4.9,
        "review_count": 124,
        "sold_count": 12,
        "view_count": 96,
        "feature_text": "ao khoac da len classic cao cap nu",
        "status": "active",
        "is_new": True,
        "is_bestseller": False,
        "image_url": "https://images.unsplash.com/photo-1763385230031-ea852e0858cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        "variants": [
            {"sku": "CT-BE-M", "color": "Be", "size": "M", "price": 2499000, "stock_quantity": 8},
            {"sku": "CT-BLK-L", "color": "Den", "size": "L", "price": 2499000, "stock_quantity": 6},
        ],
        "tags": ["new-arrival"],
    },
    {
        "slug": "vay-midi-vai-lanh",
        "name": "Vay Midi Vai Lanh",
        "short_description": "Vay midi thanh lich",
        "description": "Vay vai lanh thoang mat voi do dai midi thanh lich.",
        "base_price": 1199000,
        "brand_slug": "essence-studio",
        "category_slug": "vay",
        "average_rating": 4.8,
        "review_count": 267,
        "sold_count": 20,
        "view_count": 144,
        "feature_text": "vay midi thoang mat thanh lich nu",
        "status": "active",
        "is_new": False,
        "is_bestseller": False,
        "image_url": "https://images.unsplash.com/photo-1769107805528-964f4de0e342?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        "variants": [
            {"sku": "DR-WHT-S", "color": "Trang", "size": "S", "price": 1199000, "stock_quantity": 12},
            {"sku": "DR-SAND-M", "color": "Cat", "size": "M", "price": 1199000, "stock_quantity": 11},
        ],
        "tags": ["trending"],
    },
    {
        "slug": "so-mi-oxford-cotton",
        "name": "So Mi Oxford Cotton",
        "short_description": "So mi oxford cho nam",
        "description": "So mi cotton oxford co dien voi form dang vua van.",
        "base_price": 599000,
        "brand_slug": "essence-basics",
        "category_slug": "ao-so-mi",
        "average_rating": 4.6,
        "review_count": 301,
        "sold_count": 18,
        "view_count": 132,
        "feature_text": "so mi oxford cotton nam",
        "status": "active",
        "is_new": False,
        "is_bestseller": True,
        "image_url": "https://images.unsplash.com/photo-1722926628555-252c1c0258bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        "variants": [
            {"sku": "SH-WHT-M", "color": "Trang", "size": "M", "price": 599000, "stock_quantity": 20},
            {"sku": "SH-BLU-L", "color": "Xanh", "size": "L", "price": 599000, "stock_quantity": 16},
        ],
        "tags": ["best-seller"],
    },
    {
        "slug": "quan-tay-may-do",
        "name": "Quan Tay May Do",
        "short_description": "Quan tay cong so nam",
        "description": "Quan tay may do form slim thanh lich cho nam gioi.",
        "base_price": 999000,
        "brand_slug": "essence-basics",
        "category_slug": "quan-tay",
        "average_rating": 4.7,
        "review_count": 198,
        "sold_count": 9,
        "view_count": 88,
        "feature_text": "quan tay slim fit nam",
        "status": "active",
        "is_new": True,
        "is_bestseller": False,
        "image_url": "https://images.unsplash.com/photo-1766056278792-d5b15656b7e8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        "variants": [
            {"sku": "TR-BE-30", "color": "Be", "size": "30", "price": 999000, "stock_quantity": 16},
            {"sku": "TR-BLK-32", "color": "Den", "size": "32", "price": 999000, "stock_quantity": 15},
        ],
        "tags": ["new-arrival"],
    },
    {
        "slug": "giay-sneaker-da",
        "name": "Giay Sneaker Da",
        "short_description": "Sneaker da cho unisex",
        "description": "Giay sneaker da cao cap voi thiet ke toi gian.",
        "base_price": 1399000,
        "brand_slug": "essence-studio",
        "category_slug": "giay",
        "average_rating": 4.9,
        "review_count": 512,
        "sold_count": 42,
        "view_count": 205,
        "feature_text": "sneaker da cao cap unisex",
        "status": "active",
        "is_new": False,
        "is_bestseller": True,
        "image_url": "https://images.unsplash.com/photo-1772808800357-25b62a1f3974?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
        "variants": [
            {"sku": "SN-WHT-39", "color": "Trang", "size": "39", "price": 1399000, "stock_quantity": 12},
            {"sku": "SN-BLK-41", "color": "Den", "size": "41", "price": 1399000, "stock_quantity": 10},
        ],
        "tags": ["best-seller", "trending"],
    },
]


class Command(BaseCommand):
    help = "Seed categories, brands, products, and sample demo data."

    def handle(self, *args, **options):
        admin_user = StoreUser.objects.update_or_create(
            email="admin@local.test",
            defaults={
                "password_hash": make_password("123"),
                "phone": "0900000000",
                "role": "admin",
                "account_status": "active",
                "email_verified_at": None,
                "must_change_password": False,
            },
        )[0]
        customer_user = StoreUser.objects.update_or_create(
            email="user@local.test",
            defaults={
                "password_hash": make_password("123"),
                "phone": "0912345678",
                "role": "customer",
                "account_status": "active",
                "email_verified_at": timezone.now(),
                "must_change_password": False,
            },
        )[0]

        Customer.objects.update_or_create(
            user=admin_user,
            defaults={
                "customer_code": f"KH{admin_user.user_id:06d}",
                "full_name": "Quan tri vien",
                "gender": "other",
            },
        )
        Customer.objects.update_or_create(
            user=customer_user,
            defaults={
                "customer_code": f"KH{customer_user.user_id:06d}",
                "full_name": "Khach hang demo",
                "gender": "unknown",
            },
        )

        Address.objects.update_or_create(
            user=customer_user,
            is_default=True,
            defaults={
                "full_name": "Khach hang demo",
                "phone": "0912345678",
                "address_line": "123 Nguyen Trai",
                "ward": "Phuong 1",
                "district": "Quan 1",
                "province": "TP. Ho Chi Minh",
            },
        )

        categories_by_slug: dict[str, Category] = {}
        for item in SEED_CATEGORIES:
            parent_slug = item.get("parent_slug")
            parent = categories_by_slug.get(parent_slug) if parent_slug else None
            category, _ = Category.objects.update_or_create(
                slug=item["slug"],
                defaults={
                    "name": item["name"],
                    "description": item.get("description", ""),
                    "image_url": "",
                    "display_order": 0,
                    "is_active": True,
                    "parent": parent,
                },
            )
            categories_by_slug[item["slug"]] = category

        brands_by_slug: dict[str, Brand] = {}
        for item in SEED_BRANDS:
            brand, _ = Brand.objects.update_or_create(
                slug=item["slug"],
                defaults={
                    "name": item["name"],
                    "logo_url": item.get("logo_url", ""),
                    "description": item.get("description", ""),
                    "is_active": True,
                },
            )
            brands_by_slug[item["slug"]] = brand

        product_by_slug: dict[str, Product] = {}
        created = 0
        updated = 0

        for item in SEED_PRODUCTS:
            product, is_created = Product.objects.update_or_create(
                slug=item["slug"],
                defaults={
                    "name": item["name"],
                    "short_description": item.get("short_description", ""),
                    "description": item["description"],
                    "base_price": item["base_price"],
                    "brand": brands_by_slug[item["brand_slug"]],
                    "category": categories_by_slug[item["category_slug"]],
                    "average_rating": item["average_rating"],
                    "review_count": item["review_count"],
                    "sold_count": item["sold_count"],
                    "view_count": item["view_count"],
                    "feature_text": item["feature_text"],
                    "status": item.get("status", "active"),
                    "is_new": item.get("is_new", False),
                    "is_bestseller": item.get("is_bestseller", False),
                },
            )
            product_by_slug[item["slug"]] = product

            ProductImage.objects.update_or_create(
                product=product,
                image_url=item["image_url"],
                defaults={"alt_text": product.name, "is_primary": True, "display_order": 0},
            )

            existing_variant_ids = set()
            for index, variant in enumerate(item["variants"]):
                variant_obj, _ = ProductVariant.objects.update_or_create(
                    sku=variant["sku"],
                    defaults={
                        "product": product,
                        "color": variant["color"],
                        "size": variant["size"],
                        "price": variant.get("price", item["base_price"]),
                        "stock_quantity": variant.get("stock_quantity", 0),
                        "stock_reserved": variant.get("stock_reserved", 0),
                        "low_stock_threshold": variant.get("low_stock_threshold", 0),
                        "is_active": variant.get("is_active", True),
                    },
                )
                existing_variant_ids.add(variant_obj.variant_id)

            ProductVariant.objects.filter(product=product).exclude(variant_id__in=existing_variant_ids).delete()

            if is_created:
                created += 1
            else:
                updated += 1

        UserInteraction.objects.filter(session_id="guest-demo").delete()
        for product_slug, interaction_type, score in [
            ("ao-thun-trang-classic", "view", 1.0),
            ("ao-len-cashmere", "wishlist_add", 2.5),
            ("quan-jean-den-slim-fit", "add_to_cart", 3.0),
            ("vay-midi-vai-lanh", "purchase", 5.0),
        ]:
            UserInteraction.objects.create(
                user=None,
                session_id="guest-demo",
                product=product_by_slug[product_slug],
                interaction_type=interaction_type,
                score=score,
            )

        self.stdout.write(self.style.SUCCESS(f"Seed complete: created={created}, updated={updated}"))
