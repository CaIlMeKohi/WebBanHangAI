from __future__ import annotations

from typing import Any, Protocol


class OrderRepository(Protocol):
    def list_customer_orders(self, customer: Any) -> Any:
        ...

    def get_customer_order(self, customer: Any, order_id: int) -> Any:
        ...

    def get_customer_order_detail(self, customer: Any, order_id: int) -> Any:
        ...

    def list_staff_orders(self, filters: dict[str, Any]) -> Any:
        ...

    def list_admin_orders(self, filters: dict[str, Any]) -> Any:
        ...

    def get_admin_order_detail(self, order_id: int) -> Any:
        ...

    def create_customer_order(self, user: Any, customer: Any, payload: Any) -> Any:
        ...

    def cancel_customer_order(self, user: Any, customer: Any, order_id: int, payload: Any) -> Any:
        ...

    def confirm_customer_order_received(self, user: Any, customer: Any, order_id: int) -> Any:
        ...

    def update_order_status(self, actor: Any, order_id: int, payload: Any) -> Any:
        ...
