from rest_framework.permissions import BasePermission


class IsStoreAuthenticated(BasePermission):
    def has_permission(self, request, view):
        return bool(getattr(getattr(request, 'user', None), 'user_id', None))


class IsCustomer(IsStoreAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == 'customer'


class IsStaff(IsStoreAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role in {'staff', 'admin'}


class IsAdmin(IsStoreAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == 'admin'
