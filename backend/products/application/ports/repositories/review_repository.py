from __future__ import annotations

from typing import Any, Protocol


class ReviewRepository(Protocol):
    def create_review(self, customer: Any, payload: dict[str, Any]) -> int:
        ...

    def list_product_reviews(self, product_id: int) -> list[dict[str, Any]]:
        ...

    def list_staff_reviews(self, status: str | None = None) -> list[dict[str, Any]]:
        ...

    def moderate_review(self, staff: Any, review_id: int, action: str, reason: str = '') -> None:
        ...

    def delete_review(self, actor: Any, review_id: int) -> None:
        ...
