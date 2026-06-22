from django.db import migrations, models


SQL = r"""
IF COL_LENGTH('dbo.product_images', 'cloudinary_public_id') IS NULL
BEGIN
    ALTER TABLE dbo.product_images ADD cloudinary_public_id NVARCHAR(255) NULL;
END;

IF COL_LENGTH('dbo.product_images', 'cloudinary_asset_id') IS NULL
BEGIN
    ALTER TABLE dbo.product_images ADD cloudinary_asset_id NVARCHAR(255) NULL;
END;

IF OBJECT_ID(N'dbo.cloudinary_assets', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.cloudinary_assets (
        asset_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        public_id NVARCHAR(255) NOT NULL UNIQUE,
        cloudinary_asset_id NVARCHAR(255) NULL,
        secure_url NVARCHAR(500) NOT NULL,
        resource_type NVARCHAR(50) NOT NULL CONSTRAINT DF_cloudinary_assets_resource_type DEFAULT N'image',
        format NVARCHAR(20) NOT NULL CONSTRAINT DF_cloudinary_assets_format DEFAULT N'',
        width INT NULL,
        height INT NULL,
        bytes BIGINT NULL,
        folder NVARCHAR(255) NOT NULL CONSTRAINT DF_cloudinary_assets_folder DEFAULT N'',
        original_filename NVARCHAR(255) NOT NULL CONSTRAINT DF_cloudinary_assets_original_filename DEFAULT N'',
        created_at DATETIME2 NOT NULL CONSTRAINT DF_cloudinary_assets_created_at DEFAULT SYSDATETIME(),
        uploaded_at DATETIME2 NULL
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_product_images_cloudinary_public_id'
      AND object_id = OBJECT_ID('dbo.product_images')
)
BEGIN
    EXEC(N'CREATE INDEX IX_product_images_cloudinary_public_id
    ON dbo.product_images(cloudinary_public_id)
    WHERE cloudinary_public_id IS NOT NULL');
END;
"""


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0026_payment_refund_cancel_stock_procedures'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='productimage',
                    name='cloudinary_public_id',
                    field=models.CharField(blank=True, max_length=255, null=True),
                ),
                migrations.AddField(
                    model_name='productimage',
                    name='cloudinary_asset_id',
                    field=models.CharField(blank=True, max_length=255, null=True),
                ),
                migrations.CreateModel(
                    name='CloudinaryAsset',
                    fields=[
                        ('asset_id', models.BigAutoField(primary_key=True, serialize=False)),
                        ('public_id', models.CharField(max_length=255, unique=True)),
                        ('cloudinary_asset_id', models.CharField(blank=True, max_length=255, null=True)),
                        ('secure_url', models.CharField(max_length=500)),
                        ('resource_type', models.CharField(default='image', max_length=50)),
                        ('format', models.CharField(blank=True, max_length=20)),
                        ('width', models.IntegerField(blank=True, null=True)),
                        ('height', models.IntegerField(blank=True, null=True)),
                        ('bytes', models.BigIntegerField(blank=True, null=True)),
                        ('folder', models.CharField(blank=True, max_length=255)),
                        ('original_filename', models.CharField(blank=True, max_length=255)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('uploaded_at', models.DateTimeField(blank=True, null=True)),
                    ],
                    options={'db_table': 'cloudinary_assets'},
                ),
            ],
        ),
    ]
