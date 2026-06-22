# Project Structure

```text
WebBanHangAI-main/
  backend/
    config/                  Django project settings and URL bootstrap
    products/
      application/           Use cases, query builders, orchestration helpers
      business/              Role-based APIs pending gradual migration
      management/commands/   Seed/import commands
      migrations/            Historical migration records
      security/              JWT authentication and RBAC
      services/              External integrations
      models.py              SQL Server ORM mappings
      serializers.py         API DTOs and validation
      views.py               DRF HTTP adapters
      urls.py                Public/catalog route adapter
    recommendations/         Recommendation API/service
  frontend/
    src/app/
      components/            Reusable UI components
      context/               React providers
      data/                  Domain types/fallback data
      hooks/                 Data hooks
      lib/                   API/storage helpers
      pages/                 Route pages by feature
      types/                 Shared TS types
    dist/                    Current built UI served by Django
```

## Clean Architecture Direction

- Controllers/views should stay thin.
- Business rules belong in `application/`.
- ORM details stay in `models.py` and query helper modules.
- External systems stay in `services/`.
- Frontend pages should call hooks/lib helpers instead of embedding API logic.
