from django.db import migrations


APPLY_SQL = """
IF COL_LENGTH('dbo.orders', 'payment_expires_at') IS NULL
BEGIN
    ALTER TABLE dbo.orders ADD payment_expires_at DATETIME2 NULL;
END;

IF COL_LENGTH('dbo.payments', 'expires_at') IS NULL
BEGIN
    ALTER TABLE dbo.payments ADD expires_at DATETIME2 NULL;
END;

IF OBJECT_ID(N'dbo.payment_methods', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.payment_methods WHERE code = N'payos')
BEGIN
    INSERT INTO dbo.payment_methods (code, name, is_active, config, created_at, updated_at)
    VALUES (N'payos', N'payOS', 1, N'{}', SYSDATETIME(), SYSDATETIME());
END;
"""


REVERSE_SQL = """
IF OBJECT_ID(N'dbo.payment_methods', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM dbo.payments WHERE method = N'payos')
BEGIN
    DELETE FROM dbo.payment_methods WHERE code = N'payos';
END;

IF COL_LENGTH('dbo.payments', 'expires_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.payments DROP COLUMN expires_at;
END;

IF COL_LENGTH('dbo.orders', 'payment_expires_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.orders DROP COLUMN payment_expires_at;
END;
"""


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0034_sync_payment_expiration_state'),
    ]

    operations = [
        migrations.RunSQL(APPLY_SQL, REVERSE_SQL, state_operations=[]),
    ]
