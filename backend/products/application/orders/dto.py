from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class OrderListFilterDTO:
    status: str | None = None
    payment_method: str | None = None
    from_date: str | None = None
    to_date: str | None = None

    @classmethod
    def from_query_params(cls, params: Any) -> 'OrderListFilterDTO':
        return cls(
            status=params.get('status'),
            payment_method=params.get('payment_method'),
            from_date=params.get('from_date'),
            to_date=params.get('to_date'),
        )

    def as_dict(self) -> dict[str, str]:
        return {
            key: value
            for key, value in {
                'status': self.status,
                'payment_method': self.payment_method,
                'from_date': self.from_date,
                'to_date': self.to_date,
            }.items()
            if value
        }


@dataclass(frozen=True)
class CreateOrderDTO:
    payment_method: str = 'cod'
    cart_item_ids: list[int] | None = None
    address_id: Any = None
    receiver_name: str | None = None
    receiver_phone: str | None = None
    coupon_code: str | None = None

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> 'CreateOrderDTO':
        raw_ids = payload.get('cart_item_ids') or []
        if not isinstance(raw_ids, list):
            raw_ids = [raw_ids]
        cart_item_ids = [int(item_id) for item_id in raw_ids if str(item_id).strip()]
        return cls(
            payment_method=payload.get('payment_method', 'cod'),
            cart_item_ids=cart_item_ids,
            address_id=payload.get('address_id'),
            receiver_name=payload.get('receiver_name'),
            receiver_phone=payload.get('receiver_phone'),
            coupon_code=payload.get('coupon_code'),
        )


@dataclass(frozen=True)
class CancelOrderDTO:
    reason: str = 'Customer cancelled order'
    images: list[Any] | None = None

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> 'CancelOrderDTO':
        images = payload.get('images') or []
        if hasattr(payload, 'getlist'):
            images = payload.getlist('images')
        elif not isinstance(images, list):
            images = [images]
        return cls(reason=payload.get('reason') or 'Customer cancelled order', images=images)


@dataclass(frozen=True)
class UpdateOrderStatusDTO:
    status: str | None
    carrier_name: str | None = None
    tracking_code: str | None = None
    note: str | None = None

    @classmethod
    def from_payload(cls, payload: dict[str, Any]) -> 'UpdateOrderStatusDTO':
        return cls(
            status=payload.get('status'),
            carrier_name=str(payload.get('carrier_name', '')).strip() or None,
            tracking_code=str(payload.get('tracking_code', '')).strip() or None,
            note=str(payload.get('note', '')).strip() or None,
        )
