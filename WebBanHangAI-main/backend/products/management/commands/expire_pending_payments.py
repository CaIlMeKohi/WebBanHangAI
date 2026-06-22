from django.core.management.base import BaseCommand

from products.services.order_lifecycle import expire_pending_online_orders


class Command(BaseCommand):
    help = 'Cancel expired unpaid online orders and restore their stock.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=500)

    def handle(self, *args, **options):
        expired = expire_pending_online_orders(limit=max(1, options['limit']))
        self.stdout.write(self.style.SUCCESS(f'Expired {expired} pending online order(s).'))
