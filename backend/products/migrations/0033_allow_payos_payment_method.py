from django.db import migrations


FORWARD_SQL = """
IF OBJECT_ID(N'dbo.CK_orders_payment_method', N'C') IS NOT NULL
    ALTER TABLE dbo.orders DROP CONSTRAINT CK_orders_payment_method;

ALTER TABLE dbo.orders WITH CHECK ADD CONSTRAINT CK_orders_payment_method
CHECK (payment_method IN (N'cod', N'payos', N'vnpay', N'momo', N'bank_transfer'));

IF OBJECT_ID(N'dbo.CK_payments_method', N'C') IS NOT NULL
    ALTER TABLE dbo.payments DROP CONSTRAINT CK_payments_method;

ALTER TABLE dbo.payments WITH CHECK ADD CONSTRAINT CK_payments_method
CHECK (method IN (N'cod', N'payos', N'vnpay', N'momo', N'bank_transfer'));
"""


REVERSE_SQL = """
IF EXISTS (SELECT 1 FROM dbo.orders WHERE payment_method = N'payos')
    THROW 50001, 'Cannot remove payOS from orders while payOS rows exist.', 1;

IF EXISTS (SELECT 1 FROM dbo.payments WHERE method = N'payos')
    THROW 50002, 'Cannot remove payOS from payments while payOS rows exist.', 1;

IF OBJECT_ID(N'dbo.CK_orders_payment_method', N'C') IS NOT NULL
    ALTER TABLE dbo.orders DROP CONSTRAINT CK_orders_payment_method;

ALTER TABLE dbo.orders WITH CHECK ADD CONSTRAINT CK_orders_payment_method
CHECK (payment_method IN (N'cod', N'vnpay', N'momo', N'bank_transfer'));

IF OBJECT_ID(N'dbo.CK_payments_method', N'C') IS NOT NULL
    ALTER TABLE dbo.payments DROP CONSTRAINT CK_payments_method;

ALTER TABLE dbo.payments WITH CHECK ADD CONSTRAINT CK_payments_method
CHECK (method IN (N'cod', N'vnpay', N'momo', N'bank_transfer'));
"""


def allow_payos(apps, schema_editor):
    if schema_editor.connection.vendor != 'microsoft':
        return
    schema_editor.execute(FORWARD_SQL)


def disallow_payos(apps, schema_editor):
    if schema_editor.connection.vendor != 'microsoft':
        return
    schema_editor.execute(REVERSE_SQL)


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0032_add_payos_payment_method'),
    ]

    operations = [
        migrations.RunPython(allow_payos, disallow_payos),
    ]
