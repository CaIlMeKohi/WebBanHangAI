from __future__ import annotations

from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.users.dto import AdminUserUpdateDTO, CreateStaffOrAdminDTO
from products.application.users.use_cases import (
    CreateStaffOrAdminUseCase,
    DeleteUserUseCase,
    ListUsersUseCase,
    LoginUseCase,
    LockUserUseCase,
    LogoutUseCase,
    RegisterCustomerUseCase,
    UnlockUserUseCase,
    UpdateUserUseCase,
)
from products.business.serializers import AdminUserSerializer, AdminUserUpdateSerializer
from products.domain.common.exceptions import BusinessRuleViolation, EmailDeliveryError, NotFoundError
from products.infrastructure.django_orm.user_repository import DjangoOrmUserRepository
from products.security.permissions import IsAdmin, IsStoreAuthenticated
from products.serializers import RegisterSerializer, StoreUserSerializer


def _user_repository() -> DjangoOrmUserRepository:
    return DjangoOrmUserRepository()


class MeAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def get(self, request):
        return Response(StoreUserSerializer(request.user).data)


class AuthLoginAPIView(APIView):
    def post(self, request):
        try:
            return Response(LoginUseCase(_user_repository()).execute(request.data, request))
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class AuthRegisterAPIView(APIView):
    def post(self, request):
        try:
            payload, status_code = RegisterCustomerUseCase(_user_repository()).execute(request.data, request)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except EmailDeliveryError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(payload, status=status_code)


class LogoutAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def post(self, request):
        LogoutUseCase(_user_repository()).execute(request.user, request.auth)
        return Response({'detail': 'Dang xuat thanh cong. Hay xoa token o client.'})


class AdminUserViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = AdminUserSerializer

    def get_queryset(self):
        return ListUsersUseCase(_user_repository()).execute()


class AdminUserLockAPIView(APIView):
    permission_classes = [IsAdmin]

    def put(self, request, user_id):
        try:
            user = LockUserUseCase(_user_repository()).execute(user_id)
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        return Response(AdminUserSerializer(user).data)


class AdminUserUnlockAPIView(AdminUserLockAPIView):
    def put(self, request, user_id):
        try:
            user = UnlockUserUseCase(_user_repository()).execute(user_id)
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        return Response(AdminUserSerializer(user).data)


class AdminUserUpdateDeleteAPIView(APIView):
    permission_classes = [IsAdmin]

    def put(self, request, user_id):
        serializer = AdminUserUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user, changed_fields = UpdateUserUseCase(_user_repository()).execute(
                user_id,
                AdminUserUpdateDTO(dict(serializer.validated_data)),
            )
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        response = Response(AdminUserSerializer(user).data)
        response.changed_fields = changed_fields
        return response

    def delete(self, request, user_id):
        try:
            _user, old_value = DeleteUserUseCase(_user_repository()).execute(request.user, user_id)
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        response = Response(status=status.HTTP_204_NO_CONTENT)
        response.old_value = old_value
        return response


class AdminStaffCreateAPIView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        password = str(request.data.get('password', ''))
        serializer = RegisterSerializer(data={'username': email, 'full_name': request.data.get('full_name', email), 'password': password})
        serializer.is_valid(raise_exception=True)
        try:
            user = CreateStaffOrAdminUseCase(_user_repository()).execute(CreateStaffOrAdminDTO(dict(request.data)))
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(AdminUserSerializer(user).data, status=status.HTTP_201_CREATED)
