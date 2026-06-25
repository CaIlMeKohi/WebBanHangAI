from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AddCartItemDTO:
    product_id: Any
    variant_id: Any = None
    quantity: int = 1
    size: str | None = None
    color: str | None = None

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> 'AddCartItemDTO':
        return cls(
            product_id=payload.get('product_id'),
            variant_id=payload.get('variant_id'),
            quantity=max(1, int(payload.get('quantity', 1))),
            size=payload.get('size'),
            color=payload.get('color'),
        )

    def as_payload(self) -> dict[str, Any]:
        return {
            'product_id': self.product_id,
            'variant_id': self.variant_id,
            'quantity': self.quantity,
            'size': self.size,
            'color': self.color,
        }


@dataclass(frozen=True)
class UpdateCartItemDTO:
    quantity: int

    @classmethod
    def from_payload(cls, payload: dict[str, Any], current_quantity: int = 1) -> 'UpdateCartItemDTO':
        return cls(quantity=max(1, int(payload.get('quantity', current_quantity))))
