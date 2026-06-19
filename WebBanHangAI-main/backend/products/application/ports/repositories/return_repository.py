from __future__ import annotations

from typing import Any, Protocol


class ReturnRepository(Protocol):
    def list_customer_returns(self, customer: Any) -> Any:
        ...

    def create_return_request(self, customer: Any, payload: dict[str, Any]) -> Any:
        ...

    def list_staff_returns(self) -> Any:
        ...
