from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from products.models import EmailOutbox


class Command(BaseCommand):
    help = 'Retry pending and failed email outbox records after SMTP is configured.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100)

    def handle(self, *args, **options):
        if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
            raise CommandError('EMAIL_HOST_USER and EMAIL_HOST_PASSWORD are required.')

        items = EmailOutbox.objects.filter(status__in=['pending', 'failed']).order_by('created_at')[
            : max(1, options['limit'])
        ]
        sent = 0
        failed = 0
        for item in items:
            try:
                message = EmailMultiAlternatives(
                    subject=item.subject,
                    body='Vui lòng xem nội dung email ở định dạng HTML.',
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[item.to_email],
                    reply_to=[settings.EMAIL_HOST_USER],
                )
                message.attach_alternative(item.body, 'text/html')
                if message.send(fail_silently=False) != 1:
                    raise RuntimeError('SMTP server did not confirm email delivery')
                item.status = 'sent'
                item.sent_at = timezone.now()
                item.last_attempt_at = timezone.now()
                item.error_message = None
                item.save(update_fields=['status', 'sent_at', 'last_attempt_at', 'error_message'])
                sent += 1
            except Exception as exc:
                item.status = 'failed'
                item.retry_count += 1
                item.last_attempt_at = timezone.now()
                item.error_message = str(exc)
                item.save(update_fields=['status', 'retry_count', 'last_attempt_at', 'error_message'])
                failed += 1

        self.stdout.write(self.style.SUCCESS(f'Sent {sent} email(s); {failed} failed.'))
