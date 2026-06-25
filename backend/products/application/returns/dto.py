from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class CreateReturnRequestDTO:
    order_id: Any
    order_item_id: Any
    reason: str
    desired_solution: str
    images: list[Any] = field(default_factory=list)

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> 'CreateReturnRequestDTO':
        images = payload.get('images') or []
        if not isinstance(images, list):
            images = [images]
        return cls(
            order_id=payload.get('order_id'),
            order_item_id=payload.get('order_item_id'),
            reason=str(payload.get('reason', '')).strip(),
            desired_solution=payload.get('desired_solution', ''),
            images=images,
        )
