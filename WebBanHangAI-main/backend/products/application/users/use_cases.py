from __future__ import annotations

from products.application.ports.repositories.user_repository import UserRepository
from products.application.users.dto import AdminUserUpdateDTO, CreateStaffOrAdminDTO


class LogoutUseCase:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    def execute(self, user, auth) -> None:
        self.repository.logout(user, auth)


class ListUsersUseCase:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    def execute(self):
        return self.repository.list_users()


class LockUserUseCase:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    def execute(self, user_id: int):
        return self.repository.lock_user(user_id)


class UnlockUserUseCase:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    def execute(self, user_id: int):
        return self.repository.unlock_user(user_id)


class UpdateUserUseCase:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    def execute(self, user_id: int, dto: AdminUserUpdateDTO):
        return self.repository.update_user(user_id, dto.values)


class DeleteUserUseCase:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    def execute(self, actor, user_id: int):
        return self.repository.delete_user(actor, user_id)


class CreateStaffOrAdminUseCase:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    def execute(self, dto: CreateStaffOrAdminDTO):
        return self.repository.create_staff_or_admin(dto.payload)


class LoginUseCase:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    def execute(self, payload: dict, request):
        return self.repository.login(payload, request)


class RegisterCustomerUseCase:
    def __init__(self, repository: UserRepository):
        self.repository = repository

    def execute(self, payload: dict, request):
        return self.repository.register_customer(payload, request)
