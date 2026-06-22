from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0020_install_order_status_sp'),
    ]

    operations = [
        migrations.RunSQL(
            sql=r"""
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_orders_status_created_at'
      AND object_id = OBJECT_ID('dbo.orders')
)
BEGIN
    CREATE INDEX IX_orders_status_created_at
    ON dbo.orders(order_status, created_at)
    INCLUDE (final_amount, payment_method, payment_status);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_order_items_report_order_product'
      AND object_id = OBJECT_ID('dbo.order_items')
)
BEGIN
    CREATE INDEX IX_order_items_report_order_product
    ON dbo.order_items(order_id, product_id)
    INCLUDE (quantity, subtotal, product_name_snapshot, brand_name_snapshot, category_name_snapshot);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_user_interactions_customer_type_created'
      AND object_id = OBJECT_ID('dbo.user_interactions')
)
BEGIN
    CREATE INDEX IX_user_interactions_customer_type_created
    ON dbo.user_interactions(customer_id, interaction_type, created_at)
    INCLUDE (product_id, score, search_query);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_recommendation_logs_customer_shown'
      AND object_id = OBJECT_ID('dbo.recommendation_logs')
)
BEGIN
    CREATE INDEX IX_recommendation_logs_customer_shown
    ON dbo.recommendation_logs(customer_id, shown_at)
    INCLUDE (product_id, clicked, ordered_after_click, converted_order_id);
END;
""",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
