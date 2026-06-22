from django.db import migrations


SQLITE_COLUMNS = {
    'product_variants': [
        ("color", "varchar(100) NOT NULL DEFAULT ''"),
        ("size", "varchar(50) NOT NULL DEFAULT ''"),
        ("stock_reserved", "INTEGER NOT NULL DEFAULT 0"),
        ("low_stock_threshold", "INTEGER NOT NULL DEFAULT 0"),
        ("is_active", "bool NOT NULL DEFAULT 1"),
        ("created_at", "datetime NOT NULL DEFAULT '1970-01-01 00:00:00'"),
        ("updated_at", "datetime NOT NULL DEFAULT '1970-01-01 00:00:00'"),
    ],
    'product_images': [
        ("variant_id", "INTEGER NULL"),
        ("alt_text", "varchar(255) NOT NULL DEFAULT ''"),
        ("display_order", "INTEGER NOT NULL DEFAULT 0"),
        ("created_at", "datetime NOT NULL DEFAULT '1970-01-01 00:00:00'"),
    ],
    'wishlist_items': [
        ("customer_id", "INTEGER NULL"),
    ],
    'orders': [
        ("customer_id", "INTEGER NULL"),
        ("order_code", "varchar(50) NOT NULL DEFAULT ''"),
        ("receiver_name_snapshot", "varchar(255) NOT NULL DEFAULT ''"),
        ("receiver_phone_snapshot", "varchar(20) NOT NULL DEFAULT ''"),
        ("address_line_snapshot", "varchar(255) NOT NULL DEFAULT ''"),
        ("ward_snapshot", "varchar(100) NOT NULL DEFAULT ''"),
        ("district_snapshot", "varchar(100) NOT NULL DEFAULT ''"),
        ("province_snapshot", "varchar(100) NOT NULL DEFAULT ''"),
        ("postal_code_snapshot", "varchar(20) NULL"),
        ("subtotal_amount", "decimal NOT NULL DEFAULT 0"),
        ("order_status", "varchar(20) NOT NULL DEFAULT 'pending'"),
    ],
    'order_items': [
        ("product_name_snapshot", "varchar(255) NOT NULL DEFAULT ''"),
        ("brand_name_snapshot", "varchar(255) NOT NULL DEFAULT ''"),
        ("category_name_snapshot", "varchar(255) NOT NULL DEFAULT ''"),
        ("sku_snapshot", "varchar(100) NOT NULL DEFAULT ''"),
        ("color_snapshot", "varchar(100) NOT NULL DEFAULT ''"),
        ("size_snapshot", "varchar(50) NOT NULL DEFAULT ''"),
        ("unit_price", "decimal NOT NULL DEFAULT 0"),
        ("subtotal", "decimal NOT NULL DEFAULT 0"),
    ],
    'coupons': [
        ("coupon_type", "varchar(20) NOT NULL DEFAULT 'fixed'"),
        ("per_customer_limit", "INTEGER NOT NULL DEFAULT 1"),
        ("start_at", "datetime NULL"),
        ("end_at", "datetime NULL"),
    ],
    'payments': [
        ("method", "varchar(20) NOT NULL DEFAULT 'cod'"),
        ("transaction_code", "varchar(255) NULL"),
        ("gateway_response", "TEXT NULL"),
        ("failure_reason", "varchar(255) NULL"),
        ("refunded_at", "datetime NULL"),
        ("created_at", "datetime NOT NULL DEFAULT '1970-01-01 00:00:00'"),
        ("updated_at", "datetime NOT NULL DEFAULT '1970-01-01 00:00:00'"),
    ],
    'reviews': [
        ("customer_id", "INTEGER NULL"),
        ("order_item_id", "INTEGER NULL"),
        ("status", "varchar(20) NOT NULL DEFAULT 'pending'"),
        ("hidden_reason", "TEXT NOT NULL DEFAULT ''"),
        ("moderated_by_staff_id", "INTEGER NULL"),
        ("image_urls", "TEXT NOT NULL DEFAULT ''"),
        ("updated_at", "datetime NOT NULL DEFAULT '1970-01-01 00:00:00'"),
    ],
    'recommendation_logs': [
        ("recommendation_log_id", "INTEGER NULL"),
        ("customer_id", "INTEGER NULL"),
        ("recommendation_id", "INTEGER NULL"),
        ("shown_at", "datetime NULL"),
        ("clicked_at", "datetime NULL"),
        ("ordered_after_click", "bool NOT NULL DEFAULT 0"),
        ("converted_order_id", "INTEGER NULL"),
    ],
}


def _table_columns(cursor, table_name):
    cursor.execute(f'PRAGMA table_info("{table_name}")')
    return {row[1] for row in cursor.fetchall()}


def _table_exists(cursor, table_name):
    cursor.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = %s",
        [table_name],
    )
    return cursor.fetchone() is not None


def sync_sqlite_schema(apps, schema_editor):
    if schema_editor.connection.vendor != 'sqlite':
        return

    with schema_editor.connection.cursor() as cursor:
        for table_name, columns in SQLITE_COLUMNS.items():
            if not _table_exists(cursor, table_name):
                continue
            existing_columns = _table_columns(cursor, table_name)
            for column_name, column_sql in columns:
                if column_name not in existing_columns:
                    cursor.execute(
                        f'ALTER TABLE "{table_name}" ADD COLUMN "{column_name}" {column_sql}'
                    )
                    existing_columns.add(column_name)

        if _table_exists(cursor, 'wishlist_items') and 'user_id' in _table_columns(cursor, 'wishlist_items'):
            cursor.execute(
                """
                UPDATE wishlist_items
                SET customer_id = (
                    SELECT customer_id
                    FROM customers
                    WHERE customers.user_id = wishlist_items.user_id
                )
                WHERE customer_id IS NULL
                """
            )

        if _table_exists(cursor, 'orders'):
            columns = _table_columns(cursor, 'orders')
            if 'user_id' in columns:
                cursor.execute(
                    """
                    UPDATE orders
                    SET customer_id = (
                        SELECT customer_id
                        FROM customers
                        WHERE customers.user_id = orders.user_id
                    )
                    WHERE customer_id IS NULL
                    """
                )
            if 'total_amount' in columns:
                cursor.execute(
                    "UPDATE orders SET subtotal_amount = total_amount WHERE subtotal_amount = 0"
                )
            if 'status' in columns:
                cursor.execute(
                    "UPDATE orders SET order_status = status WHERE order_status = 'pending'"
                )
            cursor.execute(
                """
                UPDATE orders
                SET order_code = 'ORD' || substr('000000000000' || order_id, -12)
                WHERE order_code = ''
                """
            )

        if _table_exists(cursor, 'order_items'):
            columns = _table_columns(cursor, 'order_items')
            if 'price' in columns:
                cursor.execute("UPDATE order_items SET unit_price = price WHERE unit_price = 0")
            cursor.execute(
                "UPDATE order_items SET subtotal = unit_price * quantity WHERE subtotal = 0"
            )

        if _table_exists(cursor, 'coupons'):
            columns = _table_columns(cursor, 'coupons')
            if 'discount_type' in columns:
                cursor.execute(
                    "UPDATE coupons SET coupon_type = discount_type WHERE coupon_type = 'fixed'"
                )
            if 'expiry_date' in columns:
                cursor.execute("UPDATE coupons SET end_at = expiry_date WHERE end_at IS NULL")

        if _table_exists(cursor, 'payments'):
            columns = _table_columns(cursor, 'payments')
            if 'payment_method' in columns:
                cursor.execute("UPDATE payments SET method = payment_method WHERE method = 'cod'")
            if 'transaction_id' in columns:
                cursor.execute(
                    "UPDATE payments SET transaction_code = transaction_id WHERE transaction_code IS NULL"
                )

        if _table_exists(cursor, 'reviews'):
            columns = _table_columns(cursor, 'reviews')
            if 'user_id' in columns:
                cursor.execute(
                    "UPDATE reviews SET customer_id = user_id WHERE customer_id IS NULL"
                )

        if _table_exists(cursor, 'recommendation_logs'):
            columns = _table_columns(cursor, 'recommendation_logs')
            if 'log_id' in columns:
                cursor.execute(
                    """
                    UPDATE recommendation_logs
                    SET recommendation_log_id = log_id
                    WHERE recommendation_log_id IS NULL
                    """
                )
            if 'user_id' in columns:
                cursor.execute(
                    """
                    UPDATE recommendation_logs
                    SET customer_id = (
                        SELECT customer_id
                        FROM customers
                        WHERE customers.user_id = recommendation_logs.user_id
                    )
                    WHERE customer_id IS NULL
                    """
                )
            if 'created_at' in columns:
                cursor.execute(
                    "UPDATE recommendation_logs SET shown_at = created_at WHERE shown_at IS NULL"
                )

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS precomputed_recommendations (
                recommendation_id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NULL,
                product_id INTEGER NOT NULL,
                score REAL NOT NULL DEFAULT 0,
                recommendation_rank INTEGER NOT NULL DEFAULT 0,
                reason TEXT NOT NULL DEFAULT '',
                algorithm_type varchar(40) NOT NULL DEFAULT 'hybrid',
                generated_at datetime NOT NULL DEFAULT '1970-01-01 00:00:00',
                expires_at datetime NULL
            )
            """
        )


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0018_rebuild_sqlite_login_logs'),
    ]

    operations = [
        migrations.RunPython(sync_sqlite_schema, migrations.RunPython.noop),
    ]
