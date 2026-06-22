from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class CreatePaymentDTO:
    order_id: Any
    method: str | None = None

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> 'CreatePaymentDTO':
        return cls(order_id=payload.get('order_id'), method=payload.get('method'))


@dataclass(frozen=True)
class PaymentCallbackDTO:
    order_id: Any
    success: bool
    transaction_id: Any = None
    amount: Any = None
    raw_payload: dict[str, Any] | None = None

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> 'PaymentCallbackDTO':
        return cls(
            order_id=payload.get('order_id'),
            success=str(payload.get('success', 'false')).lower() in {'true', '1', 'success'},
            transaction_id=payload.get('transaction_id'),
            amount=payload.get('amount'),
            raw_payload=dict(payload),
        )
