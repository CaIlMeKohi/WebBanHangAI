from __future__ import annotations

from typing import Any, Protocol


class CartRepository(Protocol):
    def list_items(self, customer: Any) -> Any:
        ...

    def add_item(self, customer: Any, payload: dict[str, Any]) -> Any:
        ...

    def update_item_quantity(self, customer: Any, item_id: int, quantity: int) -> Any:
        ...

    def delete_item(self, customer: Any, item_id: int) -> None:
        ...
