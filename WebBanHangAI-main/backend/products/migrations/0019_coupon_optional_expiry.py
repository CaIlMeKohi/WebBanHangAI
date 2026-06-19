from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0018_add_coupon_scope'),
    ]

    operations = [
        migrations.RunSQL(
            sql=r"""
IF COL_LENGTH('dbo.coupons', 'end_at') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_coupons_end_at' AND object_id = OBJECT_ID('dbo.coupons'))
    BEGIN
        DROP INDEX IX_coupons_end_at ON dbo.coupons;
    END;

    ALTER TABLE dbo.coupons ALTER COLUMN end_at DATETIME2 NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_coupons_end_at' AND object_id = OBJECT_ID('dbo.coupons'))
    BEGIN
        CREATE INDEX IX_coupons_end_at ON dbo.coupons(end_at);
    END;
END;
""",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
