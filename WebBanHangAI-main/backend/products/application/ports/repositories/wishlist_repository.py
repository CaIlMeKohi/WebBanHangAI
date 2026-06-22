from __future__ import annotations

from typing import Any, Protocol


class WishlistRepository(Protocol):
    def list_items(self, customer: Any) -> Any:
        ...

    def add_item(self, customer: Any, product_id: Any) -> Any:
        ...

    def delete_item(self, customer: Any, product_id: Any) -> bool:
        ...
