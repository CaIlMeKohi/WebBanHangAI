from django.db import migrations, models


FORWARD_SQL = """
IF OBJECT_ID(N'dbo.CK_order_status_histories_new_status', N'C') IS NOT NULL
    ALTER TABLE dbo.order_status_histories DROP CONSTRAINT CK_order_status_histories_new_status;
IF OBJECT_ID(N'dbo.CK_order_status_histories_old_status', N'C') IS NOT NULL
    ALTER TABLE dbo.order_status_histories DROP CONSTRAINT CK_order_status_histories_old_status;
IF OBJECT_ID(N'dbo.CK_orders_order_status', N'C') IS NOT NULL
    ALTER TABLE dbo.orders DROP CONSTRAINT CK_orders_order_status;

ALTER TABLE dbo.orders WITH CHECK ADD CONSTRAINT CK_orders_order_status
CHECK (order_status IN (
    N'pending_payment', N'pending', N'confirmed', N'processing', N'waiting_pickup',
    N'shipped', N'delivered', N'completed', N'cancelled',
    N'cancellation_requested', N'return_requested', N'returned'
));

ALTER TABLE dbo.order_status_histories WITH CHECK ADD CONSTRAINT CK_order_status_histories_old_status
CHECK (old_status IS NULL OR old_status IN (
    N'pending_payment', N'pending', N'confirmed', N'processing', N'waiting_pickup',
    N'shipped', N'delivered', N'completed', N'cancelled',
    N'cancellation_requested', N'return_requested', N'returned'
));

ALTER TABLE dbo.order_status_histories WITH CHECK ADD CONSTRAINT CK_order_status_histories_new_status
CHECK (new_status IN (
    N'pending_payment', N'pending', N'confirmed', N'processing', N'waiting_pickup',
    N'shipped', N'delivered', N'completed', N'cancelled',
    N'cancellation_requested', N'return_requested', N'returned'
));

UPDATE dbo.orders
SET order_status = N'pending_payment'
WHERE payment_method = N'payos'
  AND payment_status = N'pending'
  AND order_status = N'pending';
"""


REVERSE_SQL = """
UPDATE dbo.orders
SET order_status = N'pending'
WHERE order_status = N'pending_payment';

IF OBJECT_ID(N'dbo.CK_order_status_histories_new_status', N'C') IS NOT NULL
    ALTER TABLE dbo.order_status_histories DROP CONSTRAINT CK_order_status_histories_new_status;
IF OBJECT_ID(N'dbo.CK_order_status_histories_old_status', N'C') IS NOT NULL
    ALTER TABLE dbo.order_status_histories DROP CONSTRAINT CK_order_status_histories_old_status;
IF OBJECT_ID(N'dbo.CK_orders_order_status', N'C') IS NOT NULL
    ALTER TABLE dbo.orders DROP CONSTRAINT CK_orders_order_status;

ALTER TABLE dbo.orders WITH CHECK ADD CONSTRAINT CK_orders_order_status
CHECK (order_status IN (
    N'pending', N'confirmed', N'processing', N'waiting_pickup',
    N'shipped', N'delivered', N'completed', N'cancelled',
    N'cancellation_requested', N'return_requested', N'returned'
));

ALTER TABLE dbo.order_status_histories WITH CHECK ADD CONSTRAINT CK_order_status_histories_old_status
CHECK (old_status IS NULL OR old_status IN (
    N'pending', N'confirmed', N'processing', N'waiting_pickup',
    N'shipped', N'delivered', N'completed', N'cancelled',
    N'cancellation_requested', N'return_requested', N'returned'
));

ALTER TABLE dbo.order_status_histories WITH CHECK ADD CONSTRAINT CK_order_status_histories_new_status
CHECK (new_status IN (
    N'pending', N'confirmed', N'processing', N'waiting_pickup',
    N'shipped', N'delivered', N'completed', N'cancelled',
    N'cancellation_requested', N'return_requested', N'returned'
));
"""


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0035_materialize_payment_expiration_columns'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[migrations.RunSQL(FORWARD_SQL, REVERSE_SQL)],
            state_operations=[
                migrations.AlterField(
                    model_name='order',
                    name='status',
                    field=models.CharField(
                        choices=[
                            ('pending_payment', 'Pending payment'),
                            ('pending', 'Pending'),
                            ('confirmed', 'Confirmed'),
                            ('processing', 'Processing'),
                            ('waiting_pickup', 'Waiting pickup'),
                            ('shipped', 'Shipped'),
                            ('delivered', 'Delivered'),
                            ('completed', 'Completed'),
                            ('cancelled', 'Cancelled'),
                        ],
                        db_column='order_status',
                        default='pending',
                        max_length=20,
                    ),
                ),
            ],
        ),
    ]
