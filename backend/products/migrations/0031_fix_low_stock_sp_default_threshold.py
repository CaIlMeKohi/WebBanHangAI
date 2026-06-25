from django.db import migrations


FORWARD_SQL = r"""
CREATE OR ALTER PROCEDURE dbo.sp_GetLowStockVariants
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        pv.variant_id,
        pv.product_id,
        p.name AS product_name,
        pv.sku,
        pv.color,
        pv.size,
        pv.stock_quantity,
        pv.stock_reserved,
        pv.low_stock_threshold,
        CASE
            WHEN pv.low_stock_threshold IS NULL OR pv.low_stock_threshold < 5 THEN 5
            ELSE pv.low_stock_threshold
        END AS effective_low_stock_threshold,
        pv.is_active
    FROM dbo.product_variants pv
    INNER JOIN dbo.products p ON p.product_id = pv.product_id
    WHERE pv.is_active = 1
      AND p.status = N'active'
      AND pv.stock_quantity - pv.stock_reserved <= CASE
            WHEN pv.low_stock_threshold IS NULL OR pv.low_stock_threshold < 5 THEN 5
            ELSE pv.low_stock_threshold
        END
    ORDER BY pv.stock_quantity - pv.stock_reserved ASC;
END;
"""


REVERSE_SQL = r"""
CREATE OR ALTER PROCEDURE dbo.sp_GetLowStockVariants
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        pv.variant_id,
        pv.product_id,
        p.name AS product_name,
        pv.sku,
        pv.color,
        pv.size,
        pv.stock_quantity,
        pv.stock_reserved,
        pv.low_stock_threshold,
        pv.is_active
    FROM dbo.product_variants pv
    INNER JOIN dbo.products p ON p.product_id = pv.product_id
    WHERE pv.is_active = 1
      AND pv.stock_quantity - pv.stock_reserved <= pv.low_stock_threshold
    ORDER BY pv.stock_quantity - pv.stock_reserved ASC;
END;
"""


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0030_add_review_images'),
    ]

    operations = [
        migrations.RunSQL(sql=FORWARD_SQL, reverse_sql=REVERSE_SQL),
    ]
