from importlib import import_module

from django.db import migrations


def reinstall_operational_stored_procedures(apps, schema_editor):
    module = import_module('products.migrations.0009_install_operational_stored_procedures')
    module.install_operational_stored_procedures(apps, schema_editor)


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0012_tune_recommendation_search_weight'),
    ]

    operations = [
        migrations.RunPython(
            reinstall_operational_stored_procedures,
            migrations.RunPython.noop,
        ),
    ]
