from pathlib import Path
import re

from django.db import migrations


def install_operational_stored_procedures(apps, schema_editor):
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM django_migrations
            WHERE app = 'products' AND name = '0031_fix_low_stock_sp_default_threshold'
            """
        )
        if not cursor.fetchone()[0]:
            return
    sql_path = Path(__file__).resolve().parents[2] / 'database' / 'stored_procedures.sql'
    sql = sql_path.read_text(encoding='utf-8')
    sql = re.sub(r'^\s*USE\s+\[[^\]]+\]\s*;\s*$', '', sql, flags=re.MULTILINE | re.IGNORECASE)
    batches = re.split(r'^\s*GO\s*$', sql, flags=re.MULTILINE | re.IGNORECASE)
    with schema_editor.connection.cursor() as cursor:
        for batch in batches:
            if batch.strip():
                cursor.execute(batch)


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0008_preserve_recommendation_logs_on_batch'),
    ]

    operations = [
        migrations.RunPython(
            install_operational_stored_procedures,
            migrations.RunPython.noop,
        ),
    ]
