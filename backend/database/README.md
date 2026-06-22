# Database Stored Procedures

The Django migration `products.0009_install_operational_stored_procedures`
installs this file automatically. It can also be run manually in SSMS against
`FASHION_AI_SHOP_DB` after the schema has been restored.

The script contains the procedures used by the current Django backend:

- Inventory: stock check, atomic decrease, low-stock report.
- Catalog: permanent product deletion with protected order and stock history.
- Reports: revenue, payment methods, best-selling products and brands.
- Recommendations: generate per customer, batch generation and performance.

It also contains `sp_AdjustVariantStock` for staff inventory import and
adjustment. This procedure updates stock and writes `stock_movements` in one
transaction.

Keep authentication, JWT/session handling, password hashing, email delivery,
RBAC and request validation in Django services. Those responsibilities do not
belong in stored procedures.
