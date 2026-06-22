from django.core.management.base import BaseCommand
from django.db.models import Avg, Count

from products.models import Product, Review


class Command(BaseCommand):
    help = 'Dong bo diem va so luong danh gia san pham tu cac review da duyet.'

    def handle(self, *args, **options):
        products = {
            product.product_id: product
            for product in Product.objects.only(
                'product_id',
                'average_rating',
                'review_count',
            )
        }

        for product in products.values():
            product.average_rating = 0
            product.review_count = 0

        review_stats = (
            Review.objects.filter(status='approved')
            .values('product_id')
            .annotate(
                average=Avg('rating'),
                total=Count('review_id'),
            )
        )
        for stats in review_stats:
            product = products.get(stats['product_id'])
            if product is None:
                continue
            product.average_rating = stats['average'] or 0
            product.review_count = stats['total'] or 0

        Product.objects.bulk_update(
            products.values(),
            ['average_rating', 'review_count'],
            batch_size=500,
        )
        self.stdout.write(
            self.style.SUCCESS(
                f'Da dong bo thong ke danh gia cho {len(products)} san pham.'
            )
        )
