import time

from django.core.management.base import BaseCommand

from products.infrastructure.django_orm.payment_repository import DjangoOrmPaymentRepository


class Command(BaseCommand):
    help = 'Cancel expired pending payOS orders and restore stock.'

    def add_arguments(self, parser):
        parser.add_argument('--watch', action='store_true')
        parser.add_argument('--interval', type=int, default=30)

    def handle(self, *args, **options):
        repository = DjangoOrmPaymentRepository()
        while True:
            try:
                expired = repository.expire_pending_orders()
                if expired:
                    self.stdout.write(self.style.SUCCESS(f'Expired {expired} payOS order(s).'))
            except Exception as exc:
                self.stderr.write(f'payOS expiration check failed: {exc}')
            if not options['watch']:
                return
            time.sleep(max(5, options['interval']))
