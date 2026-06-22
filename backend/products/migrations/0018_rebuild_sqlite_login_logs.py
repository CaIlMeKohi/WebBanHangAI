from django.db import migrations


def rebuild_sqlite_login_logs(apps, schema_editor):
    if schema_editor.connection.vendor != "sqlite":
        return

    with schema_editor.connection.cursor() as cursor:
        cursor.execute("DROP TABLE IF EXISTS login_logs")
        cursor.execute(
            """
            CREATE TABLE login_logs (
                login_log_id INTEGER PRIMARY KEY AUTOINCREMENT,
                email_or_phone varchar(254) NOT NULL,
                success bool NOT NULL DEFAULT 0,
                ip_address varchar(64) NOT NULL DEFAULT '',
                user_agent varchar(500) NOT NULL DEFAULT '',
                failure_reason varchar(255) NOT NULL DEFAULT '',
                created_at datetime NULL,
                user_id INTEGER NULL,
                identifier varchar(254) NOT NULL DEFAULT '',
                reason varchar(255) NOT NULL DEFAULT ''
            )
            """
        )


class Migration(migrations.Migration):
    dependencies = [
        ("products", "0017_sqlite_auth_schema_and_demo_users"),
    ]

    operations = [
        migrations.RunPython(rebuild_sqlite_login_logs, migrations.RunPython.noop),
    ]
