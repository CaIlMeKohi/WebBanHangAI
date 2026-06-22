from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CreateReviewDTO:
    order_item_id: Any
    product_id: Any
    rating: int
    comment: str
    images: list[Any]

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> 'CreateReviewDTO':
        return cls(
            order_item_id=payload.get('order_item_id'),
            product_id=payload.get('product_id'),
            rating=int(payload.get('rating', 0)),
            comment=payload.get('comment', ''),
            images=list(payload.getlist('images')) if hasattr(payload, 'getlist') else list(payload.get('images', []) or []),
        )


@dataclass(frozen=True)
class ModerateReviewDTO:
    action: str = 'approve'
    reason: str = ''

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> 'ModerateReviewDTO':
        return cls(
            action=payload.get('action', 'approve'),
            reason=str(payload.get('reason', '')).strip(),
        )
