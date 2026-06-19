from __future__ import annotations

from typing import Any, Protocol


class UserRepository(Protocol):
    def logout(self, user: Any, auth: dict[str, Any] | None) -> None:
        ...

    def list_users(self) -> Any:
        ...

    def lock_user(self, user_id: int) -> Any:
        ...

    def unlock_user(self, user_id: int) -> Any:
        ...

    def update_user(self, user_id: int, values: dict[str, Any]) -> Any:
        ...

    def delete_user(self, actor: Any, user_id: int) -> tuple[Any, dict[str, Any]]:
        ...

    def create_staff_or_admin(self, payload: dict[str, Any]) -> Any:
        ...

    def login(self, payload: dict[str, Any], request: Any) -> dict[str, Any]:
        ...

    def register_customer(self, payload: dict[str, Any], request: Any) -> tuple[dict[str, Any], int]:
        ...
