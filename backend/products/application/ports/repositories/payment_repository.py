from __future__ import annotations

from typing import Any, Protocol


class PaymentRepository(Protocol):
    def create_payment(self, user: Any, payload: dict[str, Any]) -> dict[str, Any]:
        ...

    def handle_callback(self, provider: str, payload: dict[str, Any]) -> None:
        ...

    def get_payment_status(self, user: Any, order_id: int) -> dict[str, Any]:
        ...

    def switch_to_cod(self, user: Any, order_id: int) -> dict[str, Any]:
        ...

    def reorder_as_cod(self, user: Any, order_id: int) -> Any:
        ...
