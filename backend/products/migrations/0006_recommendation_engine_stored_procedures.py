from django.db import migrations


CREATE_RECOMMENDATION_PROCEDURES = r"""
CREATE OR ALTER PROCEDURE sp_GenerateCustomerRecommendations
    @CustomerId BIGINT,
    @TopN INT = 10,
    @ColdStartThreshold INT = 5,
    @ReturnRows BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TopN < 1 SET @TopN = 10;
    IF @TopN > 100 SET @TopN = 100;

    DECLARE @InteractionCount INT =
        (SELECT COUNT(*) FROM user_interactions WHERE customer_id = @CustomerId);

    BEGIN TRANSACTION;

    UPDATE recommendation_logs
    SET recommendation_id = NULL
    WHERE recommendation_id IN (
        SELECT recommendation_id
        FROM precomputed_recommendations
        WHERE customer_id = @CustomerId
    );

    DELETE FROM precomputed_recommendations
    WHERE customer_id = @CustomerId;

    ;WITH PurchasedProducts AS (
        SELECT DISTINCT oi.product_id
        FROM orders o
        INNER JOIN order_items oi ON oi.order_id = o.order_id
        WHERE o.customer_id = @CustomerId
          AND o.order_status IN ('confirmed', 'processing', 'shipped', 'delivered')
    ),
    CategoryPreference AS (
        SELECT p.category_id, SUM(CAST(ui.score AS FLOAT)) AS score
        FROM user_interactions ui
        INNER JOIN products p ON p.product_id = ui.product_id
        WHERE ui.customer_id = @CustomerId
        GROUP BY p.category_id
    ),
    BrandPreference AS (
        SELECT p.brand_id, SUM(CAST(ui.score AS FLOAT)) AS score
        FROM user_interactions ui
        INNER JOIN products p ON p.product_id = ui.product_id
        WHERE ui.customer_id = @CustomerId
        GROUP BY p.brand_id
    ),
    RankedProducts AS (
        SELECT
            p.product_id,
            CAST(
                CASE WHEN @InteractionCount < @ColdStartThreshold THEN
                    (CASE WHEN p.is_bestseller = 1 THEN 8 ELSE 0 END)
                    + (CASE WHEN p.is_new = 1 THEN 2 ELSE 0 END)
                    + ISNULL(p.sold_count, 0) * 0.08
                    + ISNULL(p.view_count, 0) * 0.01
                    + ISNULL(p.average_rating, 0) * 2
                ELSE
                    ISNULL(cp.score, 0) * 3
                    + ISNULL(bp.score, 0) * 2
                    + (CASE WHEN p.is_bestseller = 1 THEN 4 ELSE 0 END)
                    + (CASE WHEN p.is_new = 1 THEN 1.5 ELSE 0 END)
                    + ISNULL(p.sold_count, 0) * 0.04
                    + ISNULL(p.view_count, 0) * 0.01
                    + ISNULL(p.average_rating, 0) * 3
                END AS FLOAT
            ) AS recommendation_score,
            CASE WHEN @InteractionCount < @ColdStartThreshold
                THEN N'Cold start: sản phẩm phổ biến, bán chạy, mới và rating tốt'
                ELSE N'Hybrid: ưu tiên category, brand, rating và độ phổ biến theo hành vi'
            END AS reason
        FROM products p
        LEFT JOIN CategoryPreference cp ON cp.category_id = p.category_id
        LEFT JOIN BrandPreference bp ON bp.brand_id = p.brand_id
        LEFT JOIN PurchasedProducts purchased ON purchased.product_id = p.product_id
        WHERE p.status = 'active'
          AND purchased.product_id IS NULL
    ),
    TopProducts AS (
        SELECT TOP (@TopN)
            product_id,
            recommendation_score,
            reason,
            ROW_NUMBER() OVER (ORDER BY recommendation_score DESC, product_id DESC) AS recommendation_rank
        FROM RankedProducts
        ORDER BY recommendation_score DESC, product_id DESC
    )
    INSERT INTO precomputed_recommendations (
        customer_id, product_id, recommendation_rank, score, reason,
        algorithm_type, generated_at, expires_at
    )
    SELECT
        @CustomerId,
        product_id,
        recommendation_rank,
        recommendation_score,
        reason,
        CASE WHEN @InteractionCount < @ColdStartThreshold THEN 'content_based' ELSE 'hybrid' END,
        SYSUTCDATETIME(),
        DATEADD(HOUR, 24, SYSUTCDATETIME())
    FROM TopProducts;

    COMMIT TRANSACTION;

    IF @ReturnRows = 1
    BEGIN
        SELECT
            recommendation_id, customer_id, product_id, recommendation_rank,
            score, reason, algorithm_type, generated_at, expires_at
        FROM precomputed_recommendations
        WHERE customer_id = @CustomerId
        ORDER BY recommendation_rank;
    END;
END;

CREATE OR ALTER PROCEDURE sp_RunRecommendationBatch
    @TopN INT = 10,
    @ColdStartThreshold INT = 5
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CustomerId BIGINT;
    DECLARE @Generated INT = 0;

    DECLARE customer_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT user_id
        FROM users
        WHERE role = 'customer' AND account_status = 'active';

    OPEN customer_cursor;
    FETCH NEXT FROM customer_cursor INTO @CustomerId;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC sp_GenerateCustomerRecommendations
            @CustomerId = @CustomerId,
            @TopN = @TopN,
            @ColdStartThreshold = @ColdStartThreshold,
            @ReturnRows = 0;
        SET @Generated = @Generated + @TopN;
        FETCH NEXT FROM customer_cursor INTO @CustomerId;
    END;

    CLOSE customer_cursor;
    DEALLOCATE customer_cursor;

    SELECT @Generated AS generated;
END;

CREATE OR ALTER PROCEDURE sp_ReportRecommendationPerformance
    @FromDate DATE = NULL,
    @ToDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        COUNT(*) AS impressions,
        SUM(CASE WHEN clicked = 1 THEN 1 ELSE 0 END) AS clicks,
        CAST(
            CASE WHEN COUNT(*) = 0 THEN 0
            ELSE 100.0 * SUM(CASE WHEN clicked = 1 THEN 1 ELSE 0 END) / COUNT(*)
            END AS DECIMAL(10, 2)
        ) AS ctr_percent,
        SUM(CASE WHEN ordered_after_click = 1 OR converted_order_id IS NOT NULL THEN 1 ELSE 0 END) AS conversions
    FROM recommendation_logs
    WHERE (@FromDate IS NULL OR CAST(shown_at AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(shown_at AS DATE) <= @ToDate);
END;
"""

def install_recommendation_procedures(apps, schema_editor):
    if schema_editor.connection.vendor not in {'microsoft', 'mssql'}:
        return
    batches = CREATE_RECOMMENDATION_PROCEDURES.strip().split('\nCREATE OR ALTER PROCEDURE ')
    with schema_editor.connection.cursor() as cursor:
        for index, batch in enumerate(batches):
            sql = batch if index == 0 else f'CREATE OR ALTER PROCEDURE {batch}'
            cursor.execute(sql)


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0005_add_product_tags_column'),
    ]

    operations = [
        migrations.RunPython(install_recommendation_procedures, migrations.RunPython.noop),
    ]
