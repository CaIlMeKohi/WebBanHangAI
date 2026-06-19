from django.db import migrations, models
import django.db.models.deletion


FORWARD_SQL = """
IF OBJECT_ID(N'dbo.review_images', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.review_images (
        image_id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_review_images PRIMARY KEY,
        review_id BIGINT NOT NULL,
        image_url NVARCHAR(500) NOT NULL,
        cloudinary_public_id NVARCHAR(255) NULL,
        display_order INT NOT NULL CONSTRAINT DF_review_images_display_order DEFAULT 0,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_review_images_created_at DEFAULT SYSDATETIME(),
        CONSTRAINT FK_review_images_reviews FOREIGN KEY (review_id)
            REFERENCES dbo.reviews(review_id) ON DELETE CASCADE
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.review_images')
      AND name = N'review_imag_review__dd08ad_idx'
)
BEGIN
    CREATE INDEX review_imag_review__dd08ad_idx ON dbo.review_images(review_id);
END;
"""


REVERSE_SQL = """
IF OBJECT_ID(N'dbo.review_images', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.review_images;
END;
"""


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0029_sync_order_shipping_status_constraints'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(sql=FORWARD_SQL, reverse_sql=REVERSE_SQL),
            ],
            state_operations=[
                migrations.AlterField(
                    model_name='review',
                    name='review_id',
                    field=models.BigAutoField(primary_key=True, serialize=False),
                ),
                migrations.CreateModel(
                    name='ReviewImage',
                    fields=[
                        ('image_id', models.BigAutoField(primary_key=True, serialize=False)),
                        ('image_url', models.CharField(max_length=500)),
                        ('cloudinary_public_id', models.CharField(blank=True, max_length=255, null=True)),
                        ('display_order', models.IntegerField(default=0)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        (
                            'review',
                            models.ForeignKey(
                                db_column='review_id',
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name='images',
                                to='products.review',
                            ),
                        ),
                    ],
                    options={
                        'db_table': 'review_images',
                    },
                ),
                migrations.AddIndex(
                    model_name='reviewimage',
                    index=models.Index(fields=['review'], name='review_imag_review__dd08ad_idx'),
                ),
            ],
        ),
    ]
