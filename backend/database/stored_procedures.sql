/*
    FASHION_AI_SHOP_DB - stored procedures used by the Django backend.

    Run this file in SSMS after restoring or creating the database schema.
    The script is idempotent: CREATE OR ALTER keeps existing deployments safe.
*/
USE [FASHION_AI_SHOP_DB];
GO

CREATE OR ALTER PROCEDURE dbo.sp_CheckVariantStock
    @VariantId BIGINT,
    @Quantity INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        variant_id,
        sku,
        stock_quantity,
        stock_reserved,
        available_stock = stock_quantity - stock_reserved,
        can_buy = CASE
            WHEN @Quantity > 0
             AND is_active = 1
             AND stock_quantity - stock_reserved >= @Quantity
            THEN 1 ELSE 0
        END
    FROM dbo.product_variants
    WHERE variant_id = @VariantId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_DecreaseVariantStock
    @VariantId BIGINT,
    @Quantity INT,
    @OrderId BIGINT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Quantity <= 0
        THROW 50001, 'Quantity must be greater than zero.', 1;

    BEGIN TRANSACTION;

    DECLARE @QuantityBefore INT;
    DECLARE @QuantityAfter INT;

    SELECT @QuantityBefore = stock_quantity
    FROM dbo.product_variants WITH (UPDLOCK, ROWLOCK)
    WHERE variant_id = @VariantId
      AND is_active = 1
      AND stock_quantity - stock_reserved >= @Quantity;

    IF @QuantityBefore IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        SELECT 0 AS affected_rows;
        RETURN;
    END;

    SET @QuantityAfter = @QuantityBefore - @Quantity;

    UPDATE dbo.product_variants
    SET stock_quantity = stock_quantity - @Quantity,
        updated_at = SYSUTCDATETIME()
    WHERE variant_id = @VariantId;

    INSERT INTO dbo.stock_movements (
        variant_id, order_id, staff_id, action_type,
        quantity_before, change_quantity, quantity_after,
        reason, note, created_at
    )
    VALUES (
        @VariantId, @OrderId, NULL, 'sale',
        @QuantityBefore, -@Quantity, @QuantityAfter,
        N'Checkout order stock deduction', NULL, SYSUTCDATETIME()
    );

    COMMIT TRANSACTION;

    SELECT 1 AS affected_rows;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_AdjustVariantStock
    @VariantId BIGINT,
    @ChangeQuantity INT,
    @StaffUserId BIGINT,
    @ActionType NVARCHAR(30),
    @Reason NVARCHAR(500),
    @OrderId BIGINT = NULL,
    @Note NVARCHAR(1000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @ChangeQuantity = 0
        THROW 50002, 'Change quantity must not be zero.', 1;
    IF NULLIF(LTRIM(RTRIM(@Reason)), '') IS NULL
        THROW 50003, 'Inventory adjustment reason is required.', 1;
    IF @ActionType NOT IN ('import', 'adjust', 'sale', 'return_in', 'reserve', 'release')
        THROW 50004, 'Invalid inventory action type.', 1;

    BEGIN TRANSACTION;

    DECLARE @QuantityBefore INT;
    DECLARE @QuantityAfter INT;
    DECLARE @StaffId BIGINT;

    SELECT @StaffId = staff_id
    FROM dbo.staffs WITH (UPDLOCK, HOLDLOCK)
    WHERE user_id = @StaffUserId;

    IF @StaffId IS NULL
    BEGIN
        INSERT INTO dbo.staffs (
            user_id, staff_code, full_name, position, department, status,
            can_process_orders, can_manage_inventory, can_handle_returns,
            can_moderate_reviews, created_at, updated_at
        )
        SELECT
            user_id,
            CONCAT('STAFF-', user_id),
            email,
            role,
            'operation',
            'working',
            1, 1, 1, 1,
            SYSUTCDATETIME(),
            SYSUTCDATETIME()
        FROM dbo.users
        WHERE user_id = @StaffUserId
          AND role IN ('staff', 'admin')
          AND account_status = 'active';

        SET @StaffId = SCOPE_IDENTITY();
    END;

    IF @StaffId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50008, 'Active staff profile was not found.', 1;
    END;

    SELECT @QuantityBefore = stock_quantity
    FROM dbo.product_variants WITH (UPDLOCK, ROWLOCK)
    WHERE variant_id = @VariantId;

    IF @QuantityBefore IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50005, 'Product variant was not found.', 1;
    END;

    SET @QuantityAfter = @QuantityBefore + @ChangeQuantity;
    IF @QuantityAfter < 0
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50006, 'Inventory cannot become negative.', 1;
    END;

    UPDATE dbo.product_variants
    SET stock_quantity = @QuantityAfter,
        updated_at = SYSUTCDATETIME()
    WHERE variant_id = @VariantId;

    INSERT INTO dbo.stock_movements (
        variant_id, order_id, staff_id, action_type,
        quantity_before, change_quantity, quantity_after,
        reason, note, created_at
    )
    VALUES (
        @VariantId, @OrderId, @StaffId, @ActionType,
        @QuantityBefore, @ChangeQuantity, @QuantityAfter,
        @Reason, @Note, SYSUTCDATETIME()
    );

    COMMIT TRANSACTION;

    SELECT
        @VariantId AS variant_id,
        @QuantityBefore AS quantity_before,
        @ChangeQuantity AS change_quantity,
        @QuantityAfter AS quantity_after;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GetLowStockVariants
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        pv.variant_id,
        pv.product_id,
        p.name AS product_name,
        pv.sku,
        pv.color,
        pv.size,
        pv.stock_quantity,
        pv.stock_reserved,
        pv.low_stock_threshold,
        pv.is_active
    FROM dbo.product_variants pv
    INNER JOIN dbo.products p ON p.product_id = pv.product_id
    WHERE pv.is_active = 1
      AND pv.stock_quantity - pv.stock_reserved <= pv.low_stock_threshold
    ORDER BY pv.stock_quantity - pv.stock_reserved ASC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_HardDeleteProduct
    @ProductId BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (
        SELECT 1 FROM dbo.products WHERE product_id = @ProductId
    )
    BEGIN
        SELECT CAST(0 AS BIT) AS deleted, N'Product not found.' AS reason;
        RETURN;
    END;

    IF EXISTS (
        SELECT 1 FROM dbo.order_items WHERE product_id = @ProductId
    )
    BEGIN
        SELECT CAST(0 AS BIT) AS deleted,
               N'Cannot permanently delete a product that belongs to an order. Use hidden status to preserve invoice history.' AS reason;
        RETURN;
    END;

    IF EXISTS (
        SELECT 1
        FROM dbo.stock_movements sm
        INNER JOIN dbo.product_variants pv ON pv.variant_id = sm.variant_id
        WHERE pv.product_id = @ProductId
    )
    BEGIN
        SELECT CAST(0 AS BIT) AS deleted,
               N'Cannot permanently delete a product with inventory history. Use hidden status to preserve stock logs.' AS reason;
        RETURN;
    END;

    BEGIN TRANSACTION;

    DELETE rl
    FROM dbo.recommendation_logs rl
    WHERE rl.product_id = @ProductId
       OR rl.recommendation_id IN (
            SELECT recommendation_id
            FROM dbo.precomputed_recommendations
            WHERE product_id = @ProductId
       );

    DELETE FROM dbo.precomputed_recommendations WHERE product_id = @ProductId;
    DELETE FROM dbo.user_interactions WHERE product_id = @ProductId;
    DELETE FROM dbo.wishlist_items WHERE product_id = @ProductId;
    DELETE FROM dbo.reviews WHERE product_id = @ProductId;
    DELETE FROM dbo.product_attribute_values WHERE product_id = @ProductId;

    DELETE ci
    FROM dbo.cart_items ci
    INNER JOIN dbo.product_variants pv ON pv.variant_id = ci.variant_id
    WHERE pv.product_id = @ProductId;

    DELETE sr
    FROM dbo.stock_reservations sr
    INNER JOIN dbo.product_variants pv ON pv.variant_id = sr.variant_id
    WHERE pv.product_id = @ProductId;

    DELETE FROM dbo.product_images WHERE product_id = @ProductId;
    DELETE FROM dbo.product_variants WHERE product_id = @ProductId;
    DELETE FROM dbo.products WHERE product_id = @ProductId;

    COMMIT TRANSACTION;

    SELECT CAST(1 AS BIT) AS deleted, CAST(NULL AS NVARCHAR(500)) AS reason;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ReportRevenue
    @FromDate DATETIME2 = NULL,
    @ToDate DATETIME2 = NULL,
    @GroupBy NVARCHAR(10) = 'day'
AS
BEGIN
    SET NOCOUNT ON;

    IF @GroupBy NOT IN ('day', 'month')
        THROW 50007, 'GroupBy must be day or month.', 1;

    SELECT
        CASE
            WHEN @GroupBy = 'month' THEN FORMAT(created_at, 'yyyy-MM')
            ELSE FORMAT(created_at, 'yyyy-MM-dd')
        END AS period,
        COUNT(*) AS total_orders,
        SUM(final_amount) AS revenue,
        SUM(discount_amount) AS total_discount,
        SUM(shipping_fee) AS total_shipping
    FROM dbo.orders
    WHERE order_status <> 'cancelled'
      AND (@FromDate IS NULL OR created_at >= @FromDate)
      AND (@ToDate IS NULL OR created_at < DATEADD(DAY, 1, @ToDate))
    GROUP BY CASE
        WHEN @GroupBy = 'month' THEN FORMAT(created_at, 'yyyy-MM')
        ELSE FORMAT(created_at, 'yyyy-MM-dd')
    END
    ORDER BY period;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ReportRevenueByPaymentMethod
    @FromDate DATETIME2 = NULL,
    @ToDate DATETIME2 = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        payment_method,
        payment_status,
        COUNT(*) AS total_orders,
        SUM(final_amount) AS revenue
    FROM dbo.orders
    WHERE order_status <> 'cancelled'
      AND (@FromDate IS NULL OR created_at >= @FromDate)
      AND (@ToDate IS NULL OR created_at < DATEADD(DAY, 1, @ToDate))
    GROUP BY payment_method, payment_status
    ORDER BY revenue DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ReportBestSellingProducts
    @FromDate DATETIME2 = NULL,
    @ToDate DATETIME2 = NULL,
    @Top INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Top < 1 SET @Top = 20;
    IF @Top > 500 SET @Top = 500;

    SELECT TOP (@Top)
        oi.product_id,
        oi.product_name_snapshot AS product_name,
        oi.brand_name_snapshot AS brand_name,
        oi.category_name_snapshot AS category_name,
        SUM(oi.quantity) AS sold_quantity,
        SUM(oi.subtotal) AS revenue
    FROM dbo.order_items oi
    INNER JOIN dbo.orders o ON o.order_id = oi.order_id
    WHERE o.order_status <> 'cancelled'
      AND (@FromDate IS NULL OR o.created_at >= @FromDate)
      AND (@ToDate IS NULL OR o.created_at < DATEADD(DAY, 1, @ToDate))
    GROUP BY
        oi.product_id,
        oi.product_name_snapshot,
        oi.brand_name_snapshot,
        oi.category_name_snapshot
    ORDER BY sold_quantity DESC, revenue DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ReportBestSellingBrands
    @FromDate DATETIME2 = NULL,
    @ToDate DATETIME2 = NULL,
    @Top INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    IF @Top < 1 SET @Top = 20;
    IF @Top > 500 SET @Top = 500;

    SELECT TOP (@Top)
        oi.brand_name_snapshot AS brand_name,
        SUM(oi.quantity) AS sold_quantity,
        SUM(oi.subtotal) AS revenue,
        COUNT(DISTINCT oi.order_id) AS total_orders
    FROM dbo.order_items oi
    INNER JOIN dbo.orders o ON o.order_id = oi.order_id
    WHERE o.order_status <> 'cancelled'
      AND (@FromDate IS NULL OR o.created_at >= @FromDate)
      AND (@ToDate IS NULL OR o.created_at < DATEADD(DAY, 1, @ToDate))
    GROUP BY oi.brand_name_snapshot
    ORDER BY revenue DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_GenerateCustomerRecommendations
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
    IF @ColdStartThreshold < 1 SET @ColdStartThreshold = 5;

    DECLARE @InteractionCount INT =
        (SELECT COUNT(*) FROM dbo.user_interactions WHERE customer_id = @CustomerId);

    BEGIN TRANSACTION;

    UPDATE dbo.recommendation_logs
    SET recommendation_id = NULL
    WHERE recommendation_id IN (
        SELECT recommendation_id
        FROM dbo.precomputed_recommendations
        WHERE customer_id = @CustomerId
    );

    DELETE FROM dbo.precomputed_recommendations
    WHERE customer_id = @CustomerId;

    ;WITH PurchasedProducts AS (
        SELECT DISTINCT oi.product_id
        FROM dbo.orders o
        INNER JOIN dbo.order_items oi ON oi.order_id = o.order_id
        WHERE o.customer_id = @CustomerId
          AND o.order_status IN ('confirmed', 'processing', 'shipped', 'delivered')
    ),
    CategoryPreference AS (
        SELECT p.category_id, SUM(CAST(ui.score AS FLOAT)) AS score
        FROM dbo.user_interactions ui
        INNER JOIN dbo.products p ON p.product_id = ui.product_id
        WHERE ui.customer_id = @CustomerId
        GROUP BY p.category_id
    ),
    BrandPreference AS (
        SELECT p.brand_id, SUM(CAST(ui.score AS FLOAT)) AS score
        FROM dbo.user_interactions ui
        INNER JOIN dbo.products p ON p.product_id = ui.product_id
        WHERE ui.customer_id = @CustomerId
        GROUP BY p.brand_id
    ),
    RecentSearches AS (
        SELECT
            search_query,
            score,
            ROW_NUMBER() OVER (ORDER BY created_at DESC, interaction_id DESC) AS search_rank
        FROM dbo.user_interactions
        WHERE customer_id = @CustomerId
          AND interaction_type = 'search'
          AND NULLIF(LTRIM(RTRIM(search_query)), '') IS NOT NULL
    ),
    LatestSearch AS (
        SELECT TOP (1) search_query
        FROM RecentSearches
        ORDER BY search_rank
    ),
    RankedProducts AS (
        SELECT
            p.product_id,
            CAST(CASE WHEN @InteractionCount < @ColdStartThreshold THEN
                CASE WHEN p.is_bestseller = 1 THEN 8 ELSE 0 END
                + CASE WHEN p.is_new = 1 THEN 2 ELSE 0 END
                + ISNULL(p.sold_count, 0) * 0.08
                + ISNULL(p.view_count, 0) * 0.01
                + ISNULL(p.average_rating, 0) * 2
                + ISNULL((
                    SELECT SUM(
                        CAST(search_ui.score AS FLOAT)
                        * CASE WHEN search_ui.search_rank <= 3 THEN 600 ELSE 20 END
                    )
                    FROM RecentSearches search_ui
                    WHERE search_ui.search_rank <= 30
                      AND CONCAT(p.name, ' ', p.feature_text, ' ', p.tags)
                          LIKE CONCAT('%', search_ui.search_query, '%')
                ), 0)
                + CASE WHEN EXISTS (
                    SELECT 1
                    FROM LatestSearch latest
                    WHERE CONCAT(p.name, ' ', p.feature_text, ' ', p.tags)
                        LIKE CONCAT('%', latest.search_query, '%')
                ) THEN 10000 ELSE 0 END
            ELSE
                ISNULL(cp.score, 0) * 3
                + ISNULL(bp.score, 0) * 2
                + CASE WHEN p.is_bestseller = 1 THEN 4 ELSE 0 END
                + CASE WHEN p.is_new = 1 THEN 1.5 ELSE 0 END
                + ISNULL(p.sold_count, 0) * 0.04
                + ISNULL(p.view_count, 0) * 0.01
                + ISNULL(p.average_rating, 0) * 3
                + ISNULL((
                    SELECT SUM(
                        CAST(search_ui.score AS FLOAT)
                        * CASE WHEN search_ui.search_rank <= 3 THEN 600 ELSE 20 END
                    )
                    FROM RecentSearches search_ui
                    WHERE search_ui.search_rank <= 30
                      AND CONCAT(p.name, ' ', p.feature_text, ' ', p.tags)
                          LIKE CONCAT('%', search_ui.search_query, '%')
                ), 0)
                + CASE WHEN EXISTS (
                    SELECT 1
                    FROM LatestSearch latest
                    WHERE CONCAT(p.name, ' ', p.feature_text, ' ', p.tags)
                        LIKE CONCAT('%', latest.search_query, '%')
                ) THEN 10000 ELSE 0 END
            END AS FLOAT) AS recommendation_score,
            CASE WHEN @InteractionCount < @ColdStartThreshold
                THEN N'Cold start: popular, bestseller, new and highly rated products'
                ELSE N'Hybrid: preferred categories, brands, rating and popularity'
            END AS reason
        FROM dbo.products p
        LEFT JOIN CategoryPreference cp ON cp.category_id = p.category_id
        LEFT JOIN BrandPreference bp ON bp.brand_id = p.brand_id
        LEFT JOIN PurchasedProducts purchased ON purchased.product_id = p.product_id
        WHERE p.status = 'active'
          AND purchased.product_id IS NULL
          AND EXISTS (
              SELECT 1
              FROM dbo.product_variants pv
              WHERE pv.product_id = p.product_id
                AND pv.is_active = 1
                AND pv.stock_quantity - pv.stock_reserved > 0
          )
    ),
    TopProducts AS (
        SELECT TOP (@TopN)
            product_id,
            recommendation_score,
            reason,
            ROW_NUMBER() OVER (
                ORDER BY recommendation_score DESC, product_id DESC
            ) AS recommendation_rank
        FROM RankedProducts
        ORDER BY recommendation_score DESC, product_id DESC
    )
    INSERT INTO dbo.precomputed_recommendations (
        customer_id, product_id, recommendation_rank, score, reason,
        algorithm_type, generated_at, expires_at
    )
    SELECT
        @CustomerId,
        product_id,
        recommendation_rank,
        recommendation_score,
        reason,
        CASE WHEN @InteractionCount < @ColdStartThreshold
            THEN 'content_based' ELSE 'hybrid' END,
        SYSUTCDATETIME(),
        DATEADD(HOUR, 24, SYSUTCDATETIME())
    FROM TopProducts;

    COMMIT TRANSACTION;

    IF @ReturnRows = 1
    BEGIN
        SELECT
            recommendation_id, customer_id, product_id, recommendation_rank,
            score, reason, algorithm_type, generated_at, expires_at
        FROM dbo.precomputed_recommendations
        WHERE customer_id = @CustomerId
        ORDER BY recommendation_rank;
    END;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_RunRecommendationBatch
    @TopN INT = 10,
    @ColdStartThreshold INT = 5
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @CustomerId BIGINT;
    DECLARE @Generated INT = 0;

    DECLARE customer_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT c.customer_id
        FROM dbo.customers c
        INNER JOIN dbo.users u ON u.user_id = c.user_id
        WHERE u.role = 'customer' AND u.account_status = 'active';

    OPEN customer_cursor;
    FETCH NEXT FROM customer_cursor INTO @CustomerId;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        EXEC dbo.sp_GenerateCustomerRecommendations
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
GO

CREATE OR ALTER PROCEDURE dbo.sp_ReportRecommendationPerformance
    @FromDate DATE = NULL,
    @ToDate DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        COUNT(*) AS impressions,
        SUM(CASE WHEN clicked = 1 THEN 1 ELSE 0 END) AS clicks,
        CAST(CASE WHEN COUNT(*) = 0 THEN 0
            ELSE 100.0 * SUM(CASE WHEN clicked = 1 THEN 1 ELSE 0 END) / COUNT(*)
        END AS DECIMAL(10, 2)) AS ctr_percent,
        SUM(CASE
            WHEN ordered_after_click = 1 OR converted_order_id IS NOT NULL
            THEN 1 ELSE 0
        END) AS conversions
    FROM dbo.recommendation_logs
    WHERE (@FromDate IS NULL OR CAST(shown_at AS DATE) >= @FromDate)
      AND (@ToDate IS NULL OR CAST(shown_at AS DATE) <= @ToDate);
END;
GO
