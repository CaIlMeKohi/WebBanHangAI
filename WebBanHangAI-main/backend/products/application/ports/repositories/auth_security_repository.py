from __future__ import annotations

from typing import Any, Protocol


class AuthSecurityRepository(Protocol):
    def verify_email(self, token: str) -> None:
        ...

    def resend_verification(self, user: Any) -> dict[str, Any]:
        ...

    def forgot_password(self, email: str) -> dict[str, Any]:
        ...

    def verify_password_reset_otp(self, email: str, otp: str) -> dict[str, Any]:
        ...

    def reset_password(self, payload: dict[str, Any]) -> None:
        ...

    def change_password(self, user: Any, payload: dict[str, Any]) -> None:
        ...
