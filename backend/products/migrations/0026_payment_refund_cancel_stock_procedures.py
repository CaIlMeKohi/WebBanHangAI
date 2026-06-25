from importlib import import_module

from django.db import migrations, models


def reinstall_operational_stored_procedures(apps, schema_editor):
    module = import_module('products.migrations.0009_install_operational_stored_procedures')
    module.install_operational_stored_procedures(apps, schema_editor)


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0025_support_quarter_revenue_report'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='payment_status',
            field=models.CharField(
                choices=[
                    ('unpaid', 'Unpaid'),
                    ('pending', 'Pending'),
                    ('paid', 'Paid'),
                    ('failed', 'Failed'),
                    ('refunded', 'Refunded'),
                ],
                default='unpaid',
                max_length=20,
            ),
        ),
        migrations.RunPython(
            reinstall_operational_stored_procedures,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
