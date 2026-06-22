from __future__ import annotations

from products.application.ports.repositories.auth_security_repository import AuthSecurityRepository


class VerifyEmailUseCase:
    def __init__(self, repository: AuthSecurityRepository):
        self.repository = repository

    def execute(self, token: str) -> None:
        self.repository.verify_email(token)


class ResendVerificationUseCase:
    def __init__(self, repository: AuthSecurityRepository):
        self.repository = repository

    def execute(self, user):
        return self.repository.resend_verification(user)


class ForgotPasswordUseCase:
    def __init__(self, repository: AuthSecurityRepository):
        self.repository = repository

    def execute(self, email: str):
        return self.repository.forgot_password(email)


class VerifyPasswordResetOTPUseCase:
    def __init__(self, repository: AuthSecurityRepository):
        self.repository = repository

    def execute(self, email: str, otp: str):
        return self.repository.verify_password_reset_otp(email, otp)


class ResetPasswordUseCase:
    def __init__(self, repository: AuthSecurityRepository):
        self.repository = repository

    def execute(self, payload: dict):
        self.repository.reset_password(payload)


class ChangePasswordUseCase:
    def __init__(self, repository: AuthSecurityRepository):
        self.repository = repository

    def execute(self, user, payload: dict):
        self.repository.change_password(user, payload)
