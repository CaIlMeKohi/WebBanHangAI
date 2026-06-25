from django.db import migrations


def allow_cancel_order_action(apps, schema_editor):
    if schema_editor.connection.vendor != 'microsoft':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_return_requests_requested_action'
      AND parent_object_id = OBJECT_ID('dbo.return_requests')
)
BEGIN
    ALTER TABLE dbo.return_requests DROP CONSTRAINT CK_return_requests_requested_action;
END
ALTER TABLE dbo.return_requests WITH CHECK ADD CONSTRAINT CK_return_requests_requested_action
CHECK (requested_action IN ('return', 'complaint', 'cancel_order'));
        """)


def disallow_cancel_order_action(apps, schema_editor):
    if schema_editor.connection.vendor != 'microsoft':
        return
    with schema_editor.connection.cursor() as cursor:
        cursor.execute("""
IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_return_requests_requested_action'
      AND parent_object_id = OBJECT_ID('dbo.return_requests')
)
BEGIN
    ALTER TABLE dbo.return_requests DROP CONSTRAINT CK_return_requests_requested_action;
END
ALTER TABLE dbo.return_requests WITH CHECK ADD CONSTRAINT CK_return_requests_requested_action
CHECK (requested_action IN ('return', 'complaint'));
        """)


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0036_add_pending_payment_order_status'),
    ]

    operations = [
        migrations.RunPython(allow_cancel_order_action, disallow_cancel_order_action),
    ]
