from __future__ import annotations

from typing import Any, Protocol


class CouponRepository(Protocol):
    def apply_to_cart(self, customer: Any, code: str, cart_item_ids: list[int] | None = None) -> dict[str, Any]:
        ...
