from django.db import migrations


SQL = r"""
IF OBJECT_ID(N'dbo.tags', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.tags (
        tag_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        name NVARCHAR(100) NOT NULL UNIQUE
    );
END;

IF OBJECT_ID(N'dbo.product_tags', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.product_tags (
        product_tag_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        product_id BIGINT NOT NULL,
        tag_id INT NOT NULL,
        CONSTRAINT FK_product_tags_products FOREIGN KEY (product_id) REFERENCES dbo.products(product_id) ON DELETE CASCADE,
        CONSTRAINT FK_product_tags_tags FOREIGN KEY (tag_id) REFERENCES dbo.tags(tag_id) ON DELETE CASCADE,
        CONSTRAINT UQ_product_tags UNIQUE (product_id, tag_id)
    );
END;

IF OBJECT_ID(N'dbo.inventory_logs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.inventory_logs (
        log_id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        product_id BIGINT NOT NULL,
        variant_id BIGINT NULL,
        change INT NOT NULL,
        reason NVARCHAR(100) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_inventory_logs_created_at DEFAULT SYSDATETIME(),
        CONSTRAINT FK_inventory_logs_products FOREIGN KEY (product_id) REFERENCES dbo.products(product_id) ON DELETE CASCADE,
        CONSTRAINT FK_inventory_logs_variants FOREIGN KEY (variant_id) REFERENCES dbo.product_variants(variant_id) ON DELETE SET NULL
    );
END;

IF OBJECT_ID(N'dbo.payment_methods', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.payment_methods (
        method_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        code NVARCHAR(50) NOT NULL UNIQUE,
        name NVARCHAR(100) NOT NULL,
        is_active BIT NOT NULL CONSTRAINT DF_payment_methods_is_active DEFAULT 1,
        config NVARCHAR(MAX) NOT NULL CONSTRAINT DF_payment_methods_config DEFAULT N'{}',
        created_at DATETIME2 NOT NULL CONSTRAINT DF_payment_methods_created_at DEFAULT SYSDATETIME(),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_payment_methods_updated_at DEFAULT SYSDATETIME()
    );
END;

IF OBJECT_ID(N'dbo.return_request_images', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.return_request_images (
        image_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        return_id BIGINT NOT NULL,
        image_url NVARCHAR(500) NOT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_return_request_images_created_at DEFAULT SYSDATETIME(),
        CONSTRAINT FK_return_request_images_returns FOREIGN KEY (return_id) REFERENCES dbo.return_requests(return_request_id) ON DELETE CASCADE
    );
END;

IF OBJECT_ID(N'dbo.return_status_histories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.return_status_histories (
        history_id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        return_id BIGINT NOT NULL,
        from_status NVARCHAR(20) NOT NULL CONSTRAINT DF_return_status_histories_from_status DEFAULT N'',
        to_status NVARCHAR(20) NOT NULL,
        note NVARCHAR(500) NOT NULL CONSTRAINT DF_return_status_histories_note DEFAULT N'',
        changed_by BIGINT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_return_status_histories_created_at DEFAULT SYSDATETIME(),
        CONSTRAINT FK_return_status_histories_returns FOREIGN KEY (return_id) REFERENCES dbo.return_requests(return_request_id) ON DELETE CASCADE,
        CONSTRAINT FK_return_status_histories_users FOREIGN KEY (changed_by) REFERENCES dbo.users(user_id) ON DELETE SET NULL
    );
END;
"""


class Migration(migrations.Migration):
    dependencies = [
        ('products', '0015_fix_recommendation_customer_mapping'),
    ]

    operations = [
        migrations.RunSQL(SQL, reverse_sql=migrations.RunSQL.noop),
    ]
