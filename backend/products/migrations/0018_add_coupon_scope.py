import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0017_sync_extended_model_state'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=r"""
IF COL_LENGTH('dbo.coupons', 'category_id') IS NULL
BEGIN
    ALTER TABLE dbo.coupons ADD category_id BIGINT NULL;
END;

IF COL_LENGTH('dbo.coupons', 'product_id') IS NULL
BEGIN
    ALTER TABLE dbo.coupons ADD product_id BIGINT NULL;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_coupons_categories_category_id'
)
BEGIN
    ALTER TABLE dbo.coupons
    ADD CONSTRAINT FK_coupons_categories_category_id
    FOREIGN KEY (category_id) REFERENCES dbo.categories(category_id);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.foreign_keys
    WHERE name = 'FK_coupons_products_product_id'
)
BEGIN
    ALTER TABLE dbo.coupons
    ADD CONSTRAINT FK_coupons_products_product_id
    FOREIGN KEY (product_id) REFERENCES dbo.products(product_id);
END;
""",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='coupon',
                    name='category',
                    field=models.ForeignKey(blank=True, db_column='category_id', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='coupons', to='products.category'),
                ),
                migrations.AddField(
                    model_name='coupon',
                    name='product',
                    field=models.ForeignKey(blank=True, db_column='product_id', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='coupons', to='products.product'),
                ),
            ],
        ),
    ]
