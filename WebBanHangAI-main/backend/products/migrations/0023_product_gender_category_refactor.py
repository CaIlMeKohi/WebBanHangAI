from django.db import migrations, models


def sync_product_gender(apps, schema_editor):
    statements = [
        """
        IF COL_LENGTH('dbo.products', 'gender') IS NULL
        BEGIN
            ALTER TABLE dbo.products
            ADD gender NVARCHAR(20) NOT NULL
                CONSTRAINT DF_products_gender DEFAULT N'unisex'
        END
        """,
        """
        UPDATE p
        SET gender =
            CASE
                WHEN c.slug = N'men' OR parent.slug = N'men' THEN N'men'
                WHEN c.slug = N'women' OR parent.slug = N'women' THEN N'women'
                ELSE N'unisex'
            END
        FROM dbo.products p
        INNER JOIN dbo.categories c ON c.category_id = p.category_id
        LEFT JOIN dbo.categories parent ON parent.category_id = c.parent_id
        """,
        """
        UPDATE dbo.products
        SET gender = N'unisex'
        WHERE gender NOT IN (N'men', N'women', N'unisex')
        """,
        """
        UPDATE child
        SET parent_id = NULL
        FROM dbo.categories child
        INNER JOIN dbo.categories parent ON parent.category_id = child.parent_id
        WHERE parent.slug IN (N'men', N'women', N'unisex')
        """,
        """
        UPDATE dbo.categories
        SET is_active = 0
        WHERE slug IN (N'men', N'women', N'unisex')
          AND NOT EXISTS (
              SELECT 1
              FROM dbo.products p
              WHERE p.category_id = dbo.categories.category_id
          )
        """,
        """
        IF NOT EXISTS (
            SELECT 1
            FROM sys.check_constraints
            WHERE name = N'CK_products_gender'
              AND parent_object_id = OBJECT_ID(N'dbo.products')
        )
        BEGIN
            ALTER TABLE dbo.products
            ADD CONSTRAINT CK_products_gender
            CHECK (gender IN (N'men', N'women', N'unisex'))
        END
        """,
        """
        IF NOT EXISTS (
            SELECT 1
            FROM sys.indexes
            WHERE name = N'products_gender_cat_status_idx'
              AND object_id = OBJECT_ID(N'dbo.products')
        )
        BEGIN
            CREATE INDEX products_gender_cat_status_idx
            ON dbo.products (gender, category_id, status)
        END
        """,
    ]

    for statement in statements:
        schema_editor.execute(statement)


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0022_reinstall_order_status_cancel_rule'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(sync_product_gender, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='product',
                    name='gender',
                    field=models.CharField(
                        choices=[
                            ('men', 'Men'),
                            ('women', 'Women'),
                            ('unisex', 'Unisex'),
                        ],
                        default='unisex',
                        max_length=20,
                    ),
                ),
                migrations.AddIndex(
                    model_name='product',
                    index=models.Index(
                        fields=['gender', 'category', 'status'],
                        name='products_gender_cat_status_idx',
                    ),
                ),
                migrations.AddConstraint(
                    model_name='product',
                    constraint=models.CheckConstraint(
                        check=models.Q(gender__in=['men', 'women', 'unisex']),
                        name='CK_products_gender',
                    ),
                ),
            ],
        ),
    ]
