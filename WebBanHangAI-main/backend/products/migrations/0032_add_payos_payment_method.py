from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0031_fix_low_stock_sp_default_threshold'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.AlterField(
                    model_name='order',
                    name='payment_method',
                    field=models.CharField(
                        choices=[
                            ('cod', 'COD'),
                            ('payos', 'payOS'),
                            ('vnpay', 'VNPay'),
                            ('momo', 'MoMo'),
                            ('bank_transfer', 'Bank Transfer'),
                        ],
                        max_length=20,
                    ),
                ),
                migrations.AlterField(
                    model_name='payment',
                    name='payment_method',
                    field=models.CharField(
                        choices=[
                            ('cod', 'COD'),
                            ('payos', 'payOS'),
                            ('vnpay', 'VNPay'),
                            ('momo', 'MoMo'),
                            ('bank_transfer', 'Bank Transfer'),
                        ],
                        db_column='method',
                        max_length=20,
                    ),
                ),
            ],
        ),
    ]
