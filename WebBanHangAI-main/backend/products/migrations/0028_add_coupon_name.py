from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0027_add_cloudinary_asset_support'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
IF COL_LENGTH('dbo.coupons', 'name') IS NULL
BEGIN
    ALTER TABLE dbo.coupons ADD name NVARCHAR(255) NOT NULL CONSTRAINT DF_coupons_name DEFAULT N'';
END
""",
            reverse_sql="""
IF COL_LENGTH('dbo.coupons', 'name') IS NOT NULL
BEGIN
    DECLARE @constraint_name NVARCHAR(255);
    SELECT @constraint_name = dc.name
    FROM sys.default_constraints dc
    JOIN sys.columns c ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.coupons')
      AND c.name = N'name';
    IF @constraint_name IS NOT NULL
        EXEC(N'ALTER TABLE dbo.coupons DROP CONSTRAINT ' + QUOTENAME(@constraint_name));
    ALTER TABLE dbo.coupons DROP COLUMN name;
END
""",
            state_operations=[
                migrations.AddField(
                    model_name='coupon',
                    name='name',
                    field=models.CharField(blank=True, default='', max_length=255),
                ),
            ],
        ),
    ]
