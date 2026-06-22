import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0023_product_gender_category_refactor'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RemoveConstraint(
                    model_name='cartitem',
                    name='uniq_user_product_variant_cart',
                ),
                migrations.RemoveField(
                    model_name='cartitem',
                    name='product',
                ),
                migrations.RemoveField(
                    model_name='cartitem',
                    name='user',
                ),
                migrations.AlterField(
                    model_name='cartitem',
                    name='cart_item_id',
                    field=models.BigAutoField(primary_key=True, serialize=False),
                ),
                migrations.AlterField(
                    model_name='cartitem',
                    name='variant',
                    field=models.ForeignKey(
                        db_column='variant_id',
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='cart_items',
                        to='products.productvariant',
                    ),
                ),
                migrations.AddField(
                    model_name='cartitem',
                    name='cart',
                    field=models.ForeignKey(
                        db_column='cart_id',
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='items',
                        to='products.cart',
                    ),
                ),
                migrations.AddField(
                    model_name='cartitem',
                    name='updated_at',
                    field=models.DateTimeField(auto_now=True),
                ),
            ],
        ),
    ]
