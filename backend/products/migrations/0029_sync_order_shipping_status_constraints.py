from django.db import migrations


FORWARD_SQL = """
IF OBJECT_ID(N'dbo.CK_order_status_histories_new_status', N'C') IS NOT NULL
    ALTER TABLE dbo.order_status_histories DROP CONSTRAINT CK_order_status_histories_new_status;
IF OBJECT_ID(N'dbo.CK_order_status_histories_old_status', N'C') IS NOT NULL
    ALTER TABLE dbo.order_status_histories DROP CONSTRAINT CK_order_status_histories_old_status;
IF OBJECT_ID(N'dbo.CK_orders_order_status', N'C') IS NOT NULL
    ALTER TABLE dbo.orders DROP CONSTRAINT CK_orders_order_status;
IF OBJECT_ID(N'dbo.CK_shipments_status', N'C') IS NOT NULL
    ALTER TABLE dbo.shipments DROP CONSTRAINT CK_shipments_status;

ALTER TABLE dbo.orders WITH CHECK ADD CONSTRAINT CK_orders_order_status
CHECK (order_status IN (
    N'pending', N'confirmed', N'processing', N'waiting_pickup',
    N'shipped', N'delivered', N'completed', N'cancelled',
    N'return_requested', N'returned'
));

ALTER TABLE dbo.order_status_histories WITH CHECK ADD CONSTRAINT CK_order_status_histories_old_status
CHECK (old_status IS NULL OR old_status IN (
    N'pending', N'confirmed', N'processing', N'waiting_pickup',
    N'shipped', N'delivered', N'completed', N'cancelled',
    N'return_requested', N'returned'
));

ALTER TABLE dbo.order_status_histories WITH CHECK ADD CONSTRAINT CK_order_status_histories_new_status
CHECK (new_status IN (
    N'pending', N'confirmed', N'processing', N'waiting_pickup',
    N'shipped', N'delivered', N'completed', N'cancelled',
    N'return_requested', N'returned'
));

ALTER TABLE dbo.shipments WITH CHECK ADD CONSTRAINT CK_shipments_status
CHECK (shipment_status IN (
    N'pending', N'packed', N'waiting_pickup', N'in_transit',
    N'shipped', N'delivered', N'completed', N'failed', N'returned', N'cancelled'
));
"""


REVERSE_SQL = """
IF OBJECT_ID(N'dbo.CK_order_status_histories_new_status', N'C') IS NOT NULL
    ALTER TABLE dbo.order_status_histories DROP CONSTRAINT CK_order_status_histories_new_status;
IF OBJECT_ID(N'dbo.CK_order_status_histories_old_status', N'C') IS NOT NULL
    ALTER TABLE dbo.order_status_histories DROP CONSTRAINT CK_order_status_histories_old_status;
IF OBJECT_ID(N'dbo.CK_orders_order_status', N'C') IS NOT NULL
    ALTER TABLE dbo.orders DROP CONSTRAINT CK_orders_order_status;
IF OBJECT_ID(N'dbo.CK_shipments_status', N'C') IS NOT NULL
    ALTER TABLE dbo.shipments DROP CONSTRAINT CK_shipments_status;

ALTER TABLE dbo.orders WITH CHECK ADD CONSTRAINT CK_orders_order_status
CHECK (order_status IN (
    N'pending', N'confirmed', N'processing', N'shipped',
    N'delivered', N'cancelled', N'return_requested', N'returned'
));

ALTER TABLE dbo.order_status_histories WITH CHECK ADD CONSTRAINT CK_order_status_histories_old_status
CHECK (old_status IS NULL OR old_status IN (
    N'pending', N'confirmed', N'processing', N'shipped',
    N'delivered', N'cancelled', N'return_requested', N'returned'
));

ALTER TABLE dbo.order_status_histories WITH CHECK ADD CONSTRAINT CK_order_status_histories_new_status
CHECK (new_status IN (
    N'pending', N'confirmed', N'processing', N'shipped',
    N'delivered', N'cancelled', N'return_requested', N'returned'
));

ALTER TABLE dbo.shipments WITH CHECK ADD CONSTRAINT CK_shipments_status
CHECK (shipment_status IN (
    N'pending', N'packed', N'in_transit', N'shipped',
    N'delivered', N'failed', N'returned'
));
"""


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0028_add_coupon_name'),
    ]

    operations = [
        migrations.RunSQL(sql=FORWARD_SQL, reverse_sql=REVERSE_SQL),
    ]
