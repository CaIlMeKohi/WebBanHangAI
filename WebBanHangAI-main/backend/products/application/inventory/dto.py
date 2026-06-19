from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class AdjustStockDTO:
    variant_id: Any
    change_quantity: int
    reason: str

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> 'AdjustStockDTO':
        return cls(
            variant_id=payload.get('variant_id'),
            change_quantity=int(payload.get('change_quantity')),
            reason=str(payload.get('reason', '')).strip(),
        )
