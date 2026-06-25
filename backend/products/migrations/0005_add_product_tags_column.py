from django.db import migrations, models


ADD_TAGS_COLUMN = """
IF COL_LENGTH('products', 'tags') IS NULL
BEGIN
    ALTER TABLE products ADD tags NVARCHAR(1000) NOT NULL
        CONSTRAINT DF_products_tags DEFAULT '';
END;
"""


TAG_EXISTING_PRODUCTS = """
UPDATE p
SET tags = CONCAT(
    LOWER(COALESCE(parent.slug + ',', '')),
    LOWER(COALESCE(c.slug + ',', '')),
    CASE WHEN LOWER(p.name) LIKE N'%áo%' THEN N'ao,' ELSE N'' END,
    CASE WHEN LOWER(p.name) LIKE N'%quần%' THEN N'quan,' ELSE N'' END,
    CASE WHEN LOWER(p.name) LIKE N'%váy%' OR LOWER(p.name) LIKE N'%đầm%' THEN N'vay-dam,' ELSE N'' END,
    CASE WHEN LOWER(p.name) LIKE N'%giày%' OR LOWER(p.name) LIKE N'%sneaker%' THEN N'giay,' ELSE N'' END,
    CASE WHEN LOWER(p.name) LIKE N'%túi%' OR LOWER(p.name) LIKE N'%mũ%' OR LOWER(p.name) LIKE N'%kính%' OR LOWER(p.name) LIKE N'%phụ kiện%' THEN N'phu-kien,' ELSE N'' END,
    CASE WHEN LOWER(p.name) LIKE N'%thể thao%' OR LOWER(p.name) LIKE N'%sport%' THEN N'do-the-thao,' ELSE N'' END,
    CASE WHEN LOWER(COALESCE(parent.slug, c.slug)) = 'unisex' THEN N'unisex,' ELSE N'' END
)
FROM products p
INNER JOIN categories c ON c.category_id = p.category_id
LEFT JOIN categories parent ON parent.category_id = c.parent_id;
"""


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0004_schema_sync_remaining_models'),
    ]

    operations = [
        migrations.RunSQL(
            sql=ADD_TAGS_COLUMN,
            reverse_sql=migrations.RunSQL.noop,
            state_operations=[
                migrations.AddField(
                    model_name='product',
                    name='tags',
                    field=models.CharField(blank=True, default='', max_length=1000),
                ),
            ],
        ),
        migrations.RunSQL(sql=TAG_EXISTING_PRODUCTS, reverse_sql=migrations.RunSQL.noop),
    ]
