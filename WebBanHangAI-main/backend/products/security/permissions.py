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


class StaffCapabilityPermission(IsStaff):
    capability = ''

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        if request.user.role == 'admin':
            return True
        profile = getattr(request.user, 'staff_profile', None)
        return bool(
            profile
            and profile.status in {'active', 'working'}
            and getattr(profile, self.capability, False)
        )


class CanProcessOrders(StaffCapabilityPermission):
    capability = 'can_process_orders'


class CanManageInventory(StaffCapabilityPermission):
    capability = 'can_manage_inventory'


class CanHandleReturns(StaffCapabilityPermission):
    capability = 'can_handle_returns'


class CanModerateReviews(StaffCapabilityPermission):
    capability = 'can_moderate_reviews'
