import csv
import hashlib
import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.utils.text import slugify

from products.models import Brand, Category, Product, ProductImage, ProductVariant


class Command(BaseCommand):
    help = "Import a limited number of H&M products and images."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dataset-dir",
            required=True,
            help="Folder containing articles.csv and the images directory.",
        )
        parser.add_argument(
            "--product-limit",
            type=int,
            default=2000,
            help="Maximum number of products to import (default: 2000).",
        )
        parser.add_argument(
            "--allow-missing-images",
            action="store_true",
            help="Import products even when their source image is missing.",
        )

    def handle(self, *args, **options):
        dataset_dir = Path(options["dataset_dir"]).expanduser().resolve()
        articles_path = dataset_dir / "articles.csv"
        images_dir = dataset_dir / "images"
        product_limit = options["product_limit"]
        allow_missing_images = options["allow_missing_images"]

        if product_limit < 1:
            raise CommandError("--product-limit must be greater than 0.")
        if not articles_path.is_file():
            raise CommandError(f"articles.csv not found: {articles_path}")
        if not images_dir.is_dir():
            raise CommandError(f"images directory not found: {images_dir}")

        media_dir = Path(settings.MEDIA_ROOT) / "hm"
        media_dir.mkdir(parents=True, exist_ok=True)

        brand, _ = Brand.objects.update_or_create(
            slug="hm",
            defaults={
                "name": "H&M",
                "description": "Fashion products imported from the H&M dataset.",
                "is_active": True,
            },
        )
        self.parent_categories = {}
        self.categories = {}

        imported = 0
        created = 0
        updated = 0
        skipped_missing_image = 0

        with articles_path.open("r", encoding="utf-8-sig", newline="") as file:
            reader = csv.DictReader(file)
            for row in reader:
                if imported >= product_limit:
                    break

                article_id = row.get("article_id", "").strip()
                if not article_id:
                    continue

                source_image = images_dir / article_id[:3] / f"{article_id}.jpg"
                if not source_image.is_file() and not allow_missing_images:
                    skipped_missing_image += 1
                    continue

                product, is_created = self._import_product(
                    row=row,
                    article_id=article_id,
                    brand=brand,
                    source_image=source_image,
                    media_dir=media_dir,
                )

                imported += 1
                created += int(is_created)
                updated += int(not is_created)

                if imported % 100 == 0:
                    self.stdout.write(f"Imported {imported}/{product_limit} products...")

        self.stdout.write(
            self.style.SUCCESS(
                "H&M import complete: "
                f"imported={imported}, created={created}, updated={updated}, "
                f"missing_images_skipped={skipped_missing_image}"
            )
        )

    def _import_product(self, row, article_id, brand, source_image, media_dir):
        parent_name = self._value(row, "index_group_name", "H&M")
        parent_slug = f"hm-{slugify(parent_name) or 'catalog'}"
        parent_category = self.parent_categories.get(parent_slug)
        if parent_category is None:
            parent_category, _ = Category.objects.update_or_create(
                slug=parent_slug,
                defaults={
                    "name": parent_name,
                    "description": f"H&M {parent_name}",
                    "is_active": True,
                },
            )
            self.parent_categories[parent_slug] = parent_category

        category_name = self._value(
            row,
            "product_type_name",
            self._value(row, "product_group_name", "Other"),
        )
        category_slug = f"{parent_slug}-{slugify(category_name) or 'other'}"
        category = self.categories.get(category_slug)
        if category is None:
            category, _ = Category.objects.update_or_create(
                slug=category_slug,
                defaults={
                    "name": category_name,
                    "parent": parent_category,
                    "description": self._value(row, "garment_group_name", category_name),
                    "is_active": True,
                },
            )
            self.categories[category_slug] = category

        product_name = self._value(row, "prod_name", f"H&M {article_id}")
        description = self._value(
            row,
            "detail_desc",
            f"{product_name} from the H&M fashion dataset.",
        )
        color = self._value(row, "colour_group_name", "Default")
        price = self._price_for(article_id)
        stock = self._stock_for(article_id)
        feature_parts = [
            product_name,
            color,
            self._value(row, "graphical_appearance_name"),
            self._value(row, "department_name"),
            self._value(row, "section_name"),
            self._value(row, "garment_group_name"),
        ]
        feature_text = " ".join(part for part in feature_parts if part)
        tags = ",".join(
            part
            for part in [
                self._value(row, "product_group_name"),
                self._value(row, "graphical_appearance_name"),
                color,
            ]
            if part
        )

        product, is_created = Product.objects.update_or_create(
            slug=f"hm-{article_id}",
            defaults={
                "name": product_name[:255],
                "short_description": description[:500],
                "description": description,
                "base_price": price,
                "brand": brand,
                "category": category,
                "feature_text": feature_text,
                "tags": tags[:1000],
                "status": "active",
                "is_new": False,
                "is_bestseller": False,
            },
        )

        variant, _ = ProductVariant.objects.update_or_create(
            sku=f"HM-{article_id}",
            defaults={
                "product": product,
                "color": color[:100],
                "size": "STD",
                "price": price,
                "stock_quantity": stock,
                "stock_reserved": 0,
                "low_stock_threshold": 5,
                "is_active": True,
            },
        )

        if source_image.is_file():
            destination = media_dir / f"{article_id}.jpg"
            if not destination.exists() or destination.stat().st_size != source_image.stat().st_size:
                shutil.copy2(source_image, destination)

            image_url = f"{settings.MEDIA_URL.rstrip('/')}/hm/{article_id}.jpg"
            ProductImage.objects.update_or_create(
                product=product,
                variant=variant,
                image_url=image_url,
                defaults={
                    "alt_text": product_name[:255],
                    "is_primary": True,
                    "display_order": 0,
                },
            )

        return product, is_created

    @staticmethod
    def _value(row, key, default=""):
        value = (row.get(key) or "").strip()
        return value or default

    @staticmethod
    def _stable_number(article_id):
        return int(hashlib.sha256(article_id.encode("utf-8")).hexdigest()[:8], 16)

    def _price_for(self, article_id):
        price_steps = (199000, 249000, 299000, 399000, 499000, 699000, 899000, 1199000)
        return price_steps[self._stable_number(article_id) % len(price_steps)]

    def _stock_for(self, article_id):
        return 10 + (self._stable_number(article_id) % 91)
