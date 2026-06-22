from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0032_install_stored_procedures_after_schema'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='checkout_token',
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='order',
            name='payment_status',
            field=models.CharField(
                choices=[
                    ('unpaid', 'Unpaid'),
                    ('pending', 'Pending'),
                    ('paid', 'Paid'),
                    ('failed', 'Failed'),
                    ('expired', 'Expired'),
                    ('refund_pending', 'Refund pending'),
                    ('refunded', 'Refunded'),
                ],
                default='unpaid',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='payment',
            name='expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='payment',
            name='refund_reference',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AlterField(
            model_name='payment',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('success', 'Success'),
                    ('failed', 'Failed'),
                    ('expired', 'Expired'),
                    ('refund_pending', 'Refund pending'),
                    ('refunded', 'Refunded'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
        migrations.AddConstraint(
            model_name='order',
            constraint=models.UniqueConstraint(
                condition=models.Q(checkout_token__isnull=False),
                fields=('checkout_token',),
                name='uq_orders_checkout_token_not_null',
            ),
        ),
        migrations.AddConstraint(
            model_name='payment',
            constraint=models.UniqueConstraint(
                condition=models.Q(refund_reference__isnull=False),
                fields=('refund_reference',),
                name='uq_payments_refund_reference_not_null',
            ),
        ),
    ]
