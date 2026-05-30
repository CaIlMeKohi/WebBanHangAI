# Products App Architecture

This Django app is being kept compatible with the existing SQL Server schema while moving toward a cleaner structure.

## Layers

- `models.py`: ORM mappings only. Keep business rules out of models unless they are tiny computed properties.
- `serializers.py`: API DTO shape and input validation.
- `views.py`: HTTP adapter. It should call application services/selectors and return DRF responses.
- `application/`: use cases, query builders, and orchestration logic.
- `services/`: external integrations such as email.
- `security/`: authentication and RBAC helpers.
- `business/`: additional role-based APIs that still need gradual migration into `application/`.

## Rules

- Read actual SQL Server schema before adding model fields.
- Do not run schema-changing migrations against `FASHION_AI_SHOP_DB` unless a new migration is explicitly required.
- Keep controllers thin: validate request, call service/query, serialize response.
- Keep frontend API contracts stable while refactoring backend internals.
