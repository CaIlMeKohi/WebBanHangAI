from django.contrib.auth.hashers import make_password
from django.db import migrations
from django.utils import timezone


def _table_names(cursor):
    return {
        row[0]
        for row in cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }


def _column_names(cursor, table):
    return {row[1] for row in cursor.execute(f"PRAGMA table_info({table})").fetchall()}


def _add_column(cursor, table, column, definition):
    if column not in _column_names(cursor, table):
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def _ensure_demo_user(cursor, *, email, phone, full_name, role):
    password_hash = make_password("123")
    now = timezone.now().isoformat()
    row = cursor.execute(
        "SELECT user_id FROM users WHERE email = %s OR phone = %s LIMIT 1",
        [email, phone],
    ).fetchone()

    if row:
        user_id = row[0]
        cursor.execute(
            """
            UPDATE users
            SET email = %s, phone = %s, full_name = %s, password_hash = %s, role = %s,
                is_active = 1, account_status = 'active', failed_login_count = 0,
                must_change_password = 0, updated_at = %s
            WHERE user_id = %s
            """,
            [email, phone, full_name, password_hash, role, now, user_id],
        )
        return user_id

    cursor.execute(
        """
        INSERT INTO users (
            full_name, email, password_hash, phone, role, is_active, created_at,
            account_status, email_verified_at, failed_login_count, locked_until,
            last_login_at, must_change_password, updated_at
        )
        VALUES (%s, %s, %s, %s, %s, 1, %s, 'active', %s, 0, NULL, NULL, 0, %s)
        """,
        [full_name, email, password_hash, phone, role, now, now, now],
    )
    return cursor.lastrowid


def sync_sqlite_auth_schema(apps, schema_editor):
    if schema_editor.connection.vendor != "sqlite":
        return

    with schema_editor.connection.cursor() as cursor:
        tables = _table_names(cursor)
        if "users" not in tables:
            return

        _add_column(cursor, "users", "account_status", "varchar(30) NOT NULL DEFAULT 'active'")
        _add_column(cursor, "users", "email_verified_at", "datetime NULL")
        _add_column(cursor, "users", "failed_login_count", "INTEGER NOT NULL DEFAULT 0")
        _add_column(cursor, "users", "locked_until", "datetime NULL")
        _add_column(cursor, "users", "last_login_at", "datetime NULL")
        _add_column(cursor, "users", "must_change_password", "bool NOT NULL DEFAULT 0")
        _add_column(cursor, "users", "updated_at", "datetime NULL")

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS customers (
                customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL UNIQUE,
                customer_code varchar(50) NOT NULL UNIQUE,
                full_name varchar(255) NOT NULL,
                gender varchar(20) NOT NULL DEFAULT 'unknown',
                birthday date NULL,
                avatar_url varchar(500) NULL,
                loyalty_points INTEGER NOT NULL DEFAULT 0,
                customer_rank varchar(50) NOT NULL DEFAULT 'standard',
                total_orders INTEGER NOT NULL DEFAULT 0,
                total_spent decimal NOT NULL DEFAULT 0,
                preferred_size varchar(50) NULL,
                preferred_color varchar(100) NULL,
                preferred_style varchar(100) NULL,
                created_at datetime NULL,
                updated_at datetime NULL
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS customer_addresses (
                address_id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL,
                receiver_name varchar(255) NOT NULL,
                receiver_phone varchar(20) NOT NULL,
                address_line varchar(255) NOT NULL,
                ward varchar(100) NOT NULL,
                district varchar(100) NOT NULL,
                province varchar(100) NOT NULL,
                postal_code varchar(20) NULL,
                is_default bool NOT NULL DEFAULT 0,
                created_at datetime NULL,
                updated_at datetime NULL
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS carts (
                cart_id INTEGER PRIMARY KEY AUTOINCREMENT,
                customer_id INTEGER NOT NULL UNIQUE,
                created_at datetime NULL,
                updated_at datetime NULL
            )
            """
        )

        if "cart_items" in tables:
            _add_column(cursor, "cart_items", "cart_id", "INTEGER NULL")
            _add_column(cursor, "cart_items", "updated_at", "datetime NULL")

        admin_id = _ensure_demo_user(
            cursor,
            email="admin@example.com",
            phone="admin",
            full_name="Admin Demo",
            role="admin",
        )
        user_id = _ensure_demo_user(
            cursor,
            email="user@example.com",
            phone="user",
            full_name="User Demo",
            role="customer",
        )

        now = timezone.now().isoformat()
        for store_user_id, code, full_name in [
            (admin_id, f"AD{admin_id:06d}", "Admin Demo"),
            (user_id, f"KH{user_id:06d}", "User Demo"),
        ]:
            exists = cursor.execute(
                "SELECT 1 FROM customers WHERE user_id = %s LIMIT 1",
                [store_user_id],
            ).fetchone()
            if not exists:
                cursor.execute(
                    """
                    INSERT INTO customers (
                        user_id, customer_code, full_name, gender,
                        created_at, updated_at
                    )
                    VALUES (%s, %s, %s, 'unknown', %s, %s)
                    """,
                    [store_user_id, code, full_name, now, now],
                )


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0016_checkout_cart_order_integrity"),
    ]

    operations = [
        migrations.RunPython(sync_sqlite_auth_schema, migrations.RunPython.noop),
    ]
