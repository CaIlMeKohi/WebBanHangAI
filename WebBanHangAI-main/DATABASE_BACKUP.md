# Database Backup

The full SQL Server backup is distributed separately from Git:

`backups/FASHION_AI_SHOP_DB_full.bak`

Restore it in SSMS:

1. Open **Databases > Restore Database**.
2. Choose **Device** and select the `.bak` file.
3. Restore as `FASHION_AI_SHOP_DB`.
4. Update the local `.env` SQL Server connection values.
5. Run `START_PROJECT.bat`.

The backup contains schema, stored procedures and current data. The file is
ignored by Git because binary SQL Server backups should be shared through a
drive link or team file storage.
