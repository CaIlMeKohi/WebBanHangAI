from importlib import import_module

from django.db import migrations


def reinstall_recommendation_procedures(apps, schema_editor):
    module = import_module('products.migrations.0006_recommendation_engine_stored_procedures')
    module.install_recommendation_procedures(apps, schema_editor)


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0006_recommendation_engine_stored_procedures'),
    ]

    operations = [
        migrations.RunPython(reinstall_recommendation_procedures, migrations.RunPython.noop),
    ]
