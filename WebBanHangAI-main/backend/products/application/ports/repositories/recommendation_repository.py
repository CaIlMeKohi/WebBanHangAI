from __future__ import annotations

from typing import Any, Protocol


class RecommendationRepository(Protocol):
    def for_you(self, user_id: str | None, session_id: str | None, limit: int, search: str | None = None) -> list[Any]:
        ...

    def related_products(self, product_id: str, limit: int) -> list[Any]:
        ...

    def log_for_you_impressions(self, user_id: str | None, session_id: str | None, products: list[Any]) -> None:
        ...

    def run_batch(self, top_n: int, cold_start_threshold: int) -> dict[str, Any]:
        ...

    def metrics(self, from_date: str | None = None, to_date: str | None = None) -> dict[str, Any]:
        ...

    def record_event(self, user: Any, product_id: int, event_type: str) -> None:
        ...
