from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class ApplyCouponDTO:
    code: str
    cart_item_ids: list[int] = field(default_factory=list)

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> 'ApplyCouponDTO':
        raw_ids = payload.get('cart_item_ids') or []
        if not isinstance(raw_ids, list):
            raw_ids = [raw_ids]
        ids = [int(item_id) for item_id in raw_ids if str(item_id).strip()]
        return cls(code=str(payload.get('code', '')).strip(), cart_item_ids=ids)
