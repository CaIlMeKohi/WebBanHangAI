from __future__ import annotations

from typing import Any, Protocol


class AdminConfigRepository(Protocol):
    def payment_methods_queryset(self) -> Any:
        ...

    def payment_method_fallback_rows(self) -> list[dict[str, Any]]:
        ...

    def payment_methods_table_exists(self) -> bool:
        ...

    def recommendation_configs_queryset(self) -> Any:
        ...

    def recommendation_configs_table_exists(self) -> bool:
        ...
