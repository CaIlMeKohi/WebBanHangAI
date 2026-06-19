from __future__ import annotations

from typing import Any, Protocol


class PaymentRepository(Protocol):
    def create_payment(self, user: Any, payload: dict[str, Any]) -> dict[str, Any]:
        ...

    def handle_callback(self, provider: str, payload: dict[str, Any]) -> None:
        ...
