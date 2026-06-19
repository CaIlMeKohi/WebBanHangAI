from __future__ import annotations

from typing import Any, Protocol


class ReportRepository(Protocol):
    def revenue(self, from_date: str | None = None, to_date: str | None = None, group_by: str = 'day') -> dict[str, Any]:
        ...

    def order_status(self, from_date: str | None = None, to_date: str | None = None) -> list[dict[str, Any]]:
        ...

    def best_products(self, from_date: str | None = None, to_date: str | None = None, top: int = 20) -> list[dict[str, Any]]:
        ...

    def best_brands(self, from_date: str | None = None, to_date: str | None = None, top: int = 20) -> list[dict[str, Any]]:
        ...
