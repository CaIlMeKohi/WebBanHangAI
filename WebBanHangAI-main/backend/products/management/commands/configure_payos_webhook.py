from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from products.services.payos_service import PayOSConfigurationError, PayOSGatewayError, confirm_payos_webhook


class Command(BaseCommand):
    help = 'Register the public payOS webhook URL configured in PAYOS_WEBHOOK_URL.'

    def add_arguments(self, parser):
        parser.add_argument('url', nargs='?', default='')

    def handle(self, *args, **options):
        webhook_url = (options['url'] or settings.PAYOS_WEBHOOK_URL).strip()
        if not webhook_url:
            raise CommandError('Provide a webhook URL or configure PAYOS_WEBHOOK_URL.')
        if not webhook_url.startswith('https://'):
            raise CommandError('The payOS webhook URL must be a public HTTPS URL.')
        try:
            response = confirm_payos_webhook(webhook_url)
        except (PayOSConfigurationError, PayOSGatewayError) as exc:
            raise CommandError(str(exc)) from exc
        self.stdout.write(self.style.SUCCESS(f'payOS webhook configured: {response.webhook_url}'))
