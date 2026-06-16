from django.db import migrations


SQLSERVER_CHECKOUT_SCHEMA = r"""
IF OBJECT_ID('dbo.customers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.customers (
        customer_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        customer_code NVARCHAR(50) NOT NULL,
        full_name NVARCHAR(255) NOT NULL,
        gender NVARCHAR(20) NOT NULL CONSTRAINT DF_customers_gender DEFAULT 'unknown',
        birthday DATE NULL,
        avatar_url NVARCHAR(500) NULL,
        loyalty_points INT NOT NULL CONSTRAINT DF_customers_loyalty DEFAULT 0,
        customer_rank NVARCHAR(50) NOT NULL CONSTRAINT DF_customers_rank DEFAULT 'standard',
        total_orders INT NOT NULL CONSTRAINT DF_customers_total_orders DEFAULT 0,
        total_spent DECIMAL(14,2) NOT NULL CONSTRAINT DF_customers_total_spent DEFAULT 0,
        preferred_size NVARCHAR(50) NULL,
        preferred_color NVARCHAR(100) NULL,
        preferred_style NVARCHAR(100) NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_customers_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_customers_updated_at DEFAULT SYSUTCDATETIME()
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uniq_customers_user' AND object_id = OBJECT_ID('dbo.customers'))
    CREATE UNIQUE INDEX uniq_customers_user ON dbo.customers(user_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uniq_customers_code' AND object_id = OBJECT_ID('dbo.customers'))
    CREATE UNIQUE INDEX uniq_customers_code ON dbo.customers(customer_code);

IF OBJECT_ID('dbo.users', 'U') IS NOT NULL
BEGIN
    INSERT INTO dbo.customers (user_id, customer_code, full_name, gender, created_at, updated_at)
    SELECT
        u.user_id,
        CONCAT('KH', RIGHT(CONCAT('000000', CAST(u.user_id AS VARCHAR(20))), 6)),
        COALESCE(NULLIF(u.email, ''), CONCAT('Customer ', u.user_id)),
        'unknown',
        COALESCE(u.created_at, SYSUTCDATETIME()),
        COALESCE(u.created_at, SYSUTCDATETIME())
    FROM dbo.users u
    WHERE NOT EXISTS (SELECT 1 FROM dbo.customers c WHERE c.user_id = u.user_id);
END;

IF OBJECT_ID('dbo.carts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.carts (
        cart_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        customer_id BIGINT NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_carts_created_at DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_carts_updated_at DEFAULT SYSUTCDATETIME()
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_carts_customers')
    ALTER TABLE dbo.carts WITH CHECK ADD CONSTRAINT FK_carts_customers
    FOREIGN KEY(customer_id) REFERENCES dbo.customers(customer_id) ON DELETE CASCADE;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_carts_customer' AND object_id = OBJECT_ID('dbo.carts'))
    CREATE INDEX idx_carts_customer ON dbo.carts(customer_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uniq_cart_customer' AND object_id = OBJECT_ID('dbo.carts'))
    CREATE UNIQUE INDEX uniq_cart_customer ON dbo.carts(customer_id);

IF OBJECT_ID('dbo.cart_items', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.cart_items', 'cart_id') IS NULL
        ALTER TABLE dbo.cart_items ADD cart_id BIGINT NULL;

    IF COL_LENGTH('dbo.cart_items', 'updated_at') IS NULL
        ALTER TABLE dbo.cart_items ADD updated_at DATETIME2 NOT NULL CONSTRAINT DF_cart_items_updated_at DEFAULT SYSUTCDATETIME();

    IF COL_LENGTH('dbo.cart_items', 'user_id') IS NOT NULL
    BEGIN
        EXEC(N'
            INSERT INTO dbo.carts (customer_id, created_at, updated_at)
            SELECT DISTINCT c.customer_id, SYSUTCDATETIME(), SYSUTCDATETIME()
            FROM dbo.cart_items ci
            INNER JOIN dbo.customers c ON c.user_id = ci.user_id
            WHERE ci.cart_id IS NULL
              AND NOT EXISTS (SELECT 1 FROM dbo.carts existing WHERE existing.customer_id = c.customer_id);

            UPDATE ci
            SET cart_id = cart.cart_id
            FROM dbo.cart_items ci
            INNER JOIN dbo.customers c ON c.user_id = ci.user_id
            INNER JOIN dbo.carts cart ON cart.customer_id = c.customer_id
            WHERE ci.cart_id IS NULL;
        ');
    END;

    IF COL_LENGTH('dbo.cart_items', 'variant_id') IS NOT NULL AND COL_LENGTH('dbo.cart_items', 'product_id') IS NOT NULL
    BEGIN
        EXEC(N'
            UPDATE ci
            SET variant_id = picked.variant_id
            FROM dbo.cart_items ci
            CROSS APPLY (
                SELECT TOP 1 pv.variant_id
                FROM dbo.product_variants pv
                WHERE pv.product_id = ci.product_id
                ORDER BY pv.variant_id
            ) picked
            WHERE ci.variant_id IS NULL;
        ');
    END;

    DELETE FROM dbo.cart_items
    WHERE cart_id IS NULL OR variant_id IS NULL OR quantity IS NULL OR quantity < 1;

    ;WITH ranked AS (
        SELECT
            cart_item_id,
            ROW_NUMBER() OVER (
                PARTITION BY cart_id, variant_id
                ORDER BY updated_at DESC, added_at DESC, cart_item_id DESC
            ) AS row_number
        FROM dbo.cart_items
    )
    DELETE FROM ranked WHERE row_number > 1;

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_cart_items_carts')
        ALTER TABLE dbo.cart_items WITH CHECK ADD CONSTRAINT FK_cart_items_carts
        FOREIGN KEY(cart_id) REFERENCES dbo.carts(cart_id) ON DELETE CASCADE;

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_cart_items_variants')
        ALTER TABLE dbo.cart_items WITH CHECK ADD CONSTRAINT FK_cart_items_variants
        FOREIGN KEY(variant_id) REFERENCES dbo.product_variants(variant_id) ON DELETE CASCADE;

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'chk_cart_item_quantity_positive')
        ALTER TABLE dbo.cart_items WITH CHECK ADD CONSTRAINT chk_cart_item_quantity_positive CHECK (quantity >= 1);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_cart_items_cart' AND object_id = OBJECT_ID('dbo.cart_items'))
        CREATE INDEX idx_cart_items_cart ON dbo.cart_items(cart_id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_cart_items_variant' AND object_id = OBJECT_ID('dbo.cart_items'))
        CREATE INDEX idx_cart_items_variant ON dbo.cart_items(variant_id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'uniq_cart_variant' AND object_id = OBJECT_ID('dbo.cart_items'))
        CREATE UNIQUE INDEX uniq_cart_variant ON dbo.cart_items(cart_id, variant_id);
END;

IF OBJECT_ID('dbo.orders', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.orders', 'customer_id') IS NULL
        ALTER TABLE dbo.orders ADD customer_id BIGINT NULL;

    IF COL_LENGTH('dbo.orders', 'user_id') IS NOT NULL
    BEGIN
        EXEC(N'
            UPDATE o
            SET customer_id = c.customer_id
            FROM dbo.orders o
            INNER JOIN dbo.customers c ON c.user_id = o.user_id
            WHERE o.customer_id IS NULL;
        ');
    END;

    IF COL_LENGTH('dbo.orders', 'order_code') IS NULL
        ALTER TABLE dbo.orders ADD order_code NVARCHAR(50) NULL;

    UPDATE dbo.orders
    SET order_code = CONCAT('ORD', RIGHT(CONCAT('000000000000', CAST(order_id AS VARCHAR(20))), 12))
    WHERE order_code IS NULL OR order_code = '';

    IF COL_LENGTH('dbo.orders', 'subtotal_amount') IS NULL
        ALTER TABLE dbo.orders ADD subtotal_amount DECIMAL(14,2) NULL;

    IF COL_LENGTH('dbo.orders', 'total_amount') IS NOT NULL
        EXEC(N'UPDATE dbo.orders SET subtotal_amount = total_amount WHERE subtotal_amount IS NULL;');

    IF COL_LENGTH('dbo.orders', 'order_status') IS NULL
        ALTER TABLE dbo.orders ADD order_status NVARCHAR(20) NULL;

    IF COL_LENGTH('dbo.orders', 'status') IS NOT NULL
        EXEC(N'UPDATE dbo.orders SET order_status = status WHERE order_status IS NULL;');

    UPDATE dbo.orders SET order_status = 'pending' WHERE order_status IS NULL;

    IF COL_LENGTH('dbo.orders', 'receiver_name_snapshot') IS NULL
        ALTER TABLE dbo.orders ADD receiver_name_snapshot NVARCHAR(255) NOT NULL CONSTRAINT DF_orders_receiver_name_snapshot DEFAULT '';
    IF COL_LENGTH('dbo.orders', 'receiver_phone_snapshot') IS NULL
        ALTER TABLE dbo.orders ADD receiver_phone_snapshot NVARCHAR(20) NOT NULL CONSTRAINT DF_orders_receiver_phone_snapshot DEFAULT '';
    IF COL_LENGTH('dbo.orders', 'address_line_snapshot') IS NULL
        ALTER TABLE dbo.orders ADD address_line_snapshot NVARCHAR(255) NOT NULL CONSTRAINT DF_orders_address_line_snapshot DEFAULT '';
    IF COL_LENGTH('dbo.orders', 'ward_snapshot') IS NULL
        ALTER TABLE dbo.orders ADD ward_snapshot NVARCHAR(100) NOT NULL CONSTRAINT DF_orders_ward_snapshot DEFAULT '';
    IF COL_LENGTH('dbo.orders', 'district_snapshot') IS NULL
        ALTER TABLE dbo.orders ADD district_snapshot NVARCHAR(100) NOT NULL CONSTRAINT DF_orders_district_snapshot DEFAULT '';
    IF COL_LENGTH('dbo.orders', 'province_snapshot') IS NULL
        ALTER TABLE dbo.orders ADD province_snapshot NVARCHAR(100) NOT NULL CONSTRAINT DF_orders_province_snapshot DEFAULT '';
    IF COL_LENGTH('dbo.orders', 'postal_code_snapshot') IS NULL
        ALTER TABLE dbo.orders ADD postal_code_snapshot NVARCHAR(20) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_orders_customers')
        ALTER TABLE dbo.orders WITH CHECK ADD CONSTRAINT FK_orders_customers
        FOREIGN KEY(customer_id) REFERENCES dbo.customers(customer_id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_orders_customer' AND object_id = OBJECT_ID('dbo.orders'))
        CREATE INDEX idx_orders_customer ON dbo.orders(customer_id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_orders_customer_created' AND object_id = OBJECT_ID('dbo.orders'))
        CREATE INDEX idx_orders_customer_created ON dbo.orders(customer_id, created_at DESC);
END;

IF OBJECT_ID('dbo.order_items', 'U') IS NOT NULL
BEGIN
    IF COL_LENGTH('dbo.order_items', 'unit_price') IS NULL
        ALTER TABLE dbo.order_items ADD unit_price DECIMAL(14,2) NULL;

    IF COL_LENGTH('dbo.order_items', 'price') IS NOT NULL
        EXEC(N'UPDATE dbo.order_items SET unit_price = price WHERE unit_price IS NULL;');

    UPDATE dbo.order_items SET unit_price = 0 WHERE unit_price IS NULL;

    IF COL_LENGTH('dbo.order_items', 'subtotal') IS NULL
        ALTER TABLE dbo.order_items ADD subtotal DECIMAL(14,2) NULL;

    UPDATE dbo.order_items
    SET subtotal = unit_price * quantity
    WHERE subtotal IS NULL;

    IF COL_LENGTH('dbo.order_items', 'product_name_snapshot') IS NULL
        ALTER TABLE dbo.order_items ADD product_name_snapshot NVARCHAR(255) NOT NULL CONSTRAINT DF_order_items_product_name_snapshot DEFAULT '';
    IF COL_LENGTH('dbo.order_items', 'brand_name_snapshot') IS NULL
        ALTER TABLE dbo.order_items ADD brand_name_snapshot NVARCHAR(255) NOT NULL CONSTRAINT DF_order_items_brand_name_snapshot DEFAULT '';
    IF COL_LENGTH('dbo.order_items', 'category_name_snapshot') IS NULL
        ALTER TABLE dbo.order_items ADD category_name_snapshot NVARCHAR(255) NOT NULL CONSTRAINT DF_order_items_category_name_snapshot DEFAULT '';
    IF COL_LENGTH('dbo.order_items', 'sku_snapshot') IS NULL
        ALTER TABLE dbo.order_items ADD sku_snapshot NVARCHAR(100) NOT NULL CONSTRAINT DF_order_items_sku_snapshot DEFAULT '';
    IF COL_LENGTH('dbo.order_items', 'color_snapshot') IS NULL
        ALTER TABLE dbo.order_items ADD color_snapshot NVARCHAR(100) NOT NULL CONSTRAINT DF_order_items_color_snapshot DEFAULT '';
    IF COL_LENGTH('dbo.order_items', 'size_snapshot') IS NULL
        ALTER TABLE dbo.order_items ADD size_snapshot NVARCHAR(50) NOT NULL CONSTRAINT DF_order_items_size_snapshot DEFAULT '';

    UPDATE oi
    SET
        product_name_snapshot = CASE WHEN oi.product_name_snapshot = '' THEN p.name ELSE oi.product_name_snapshot END,
        brand_name_snapshot = CASE WHEN oi.brand_name_snapshot = '' THEN COALESCE(b.name, '') ELSE oi.brand_name_snapshot END,
        category_name_snapshot = CASE WHEN oi.category_name_snapshot = '' THEN COALESCE(c.name, '') ELSE oi.category_name_snapshot END,
        sku_snapshot = CASE WHEN oi.sku_snapshot = '' THEN COALESCE(pv.sku, '') ELSE oi.sku_snapshot END,
        color_snapshot = CASE WHEN oi.color_snapshot = '' THEN COALESCE(pv.color, '') ELSE oi.color_snapshot END,
        size_snapshot = CASE WHEN oi.size_snapshot = '' THEN COALESCE(pv.size, '') ELSE oi.size_snapshot END
    FROM dbo.order_items oi
    INNER JOIN dbo.products p ON p.product_id = oi.product_id
    LEFT JOIN dbo.brands b ON b.brand_id = p.brand_id
    LEFT JOIN dbo.categories c ON c.category_id = p.category_id
    LEFT JOIN dbo.product_variants pv ON pv.variant_id = oi.variant_id;

    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'chk_order_item_quantity_positive')
        ALTER TABLE dbo.order_items WITH CHECK ADD CONSTRAINT chk_order_item_quantity_positive CHECK (quantity >= 1);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_order_items_order' AND object_id = OBJECT_ID('dbo.order_items'))
        CREATE INDEX idx_order_items_order ON dbo.order_items(order_id);

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_order_items_product' AND object_id = OBJECT_ID('dbo.order_items'))
        CREATE INDEX idx_order_items_product ON dbo.order_items(product_id);
END;
"""


def sync_checkout_schema(apps, schema_editor):
    if schema_editor.connection.vendor not in {'microsoft', 'mssql'}:
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(SQLSERVER_CHECKOUT_SCHEMA)


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0015_fix_recommendation_customer_mapping'),
    ]

    operations = [
        migrations.RunPython(sync_checkout_schema, migrations.RunPython.noop),
    ]
