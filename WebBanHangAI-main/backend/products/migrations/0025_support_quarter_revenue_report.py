from importlib import import_module

from django.db import migrations


def reinstall_operational_stored_procedures(apps, schema_editor):
    module = import_module('products.migrations.0009_install_operational_stored_procedures')
    module.install_operational_stored_procedures(apps, schema_editor)


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0024_sync_cart_item_state'),
    ]

    operations = [
        migrations.RunPython(
            reinstall_operational_stored_procedures,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
