from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0033_allow_payos_payment_method'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AddField(
                    model_name='order',
                    name='payment_expires_at',
                    field=models.DateTimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name='payment',
                    name='expires_at',
                    field=models.DateTimeField(blank=True, null=True),
                ),
            ],
        ),
    ]
