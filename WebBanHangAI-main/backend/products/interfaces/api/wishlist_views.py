from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.customer_context import get_customer_for_user
from products.application.wishlist.use_cases import (
    AddWishlistItemUseCase,
    DeleteWishlistItemUseCase,
    ListWishlistItemsUseCase,
)
from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.infrastructure.django_orm.wishlist_repository import DjangoOrmWishlistRepository
from products.security.permissions import IsCustomer
from products.serializers import WishlistItemSerializer


def _wishlist_repository() -> DjangoOrmWishlistRepository:
    return DjangoOrmWishlistRepository()


def _get_customer(user):
    return get_customer_for_user(user)


class WishlistAPIView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        user = request.user
        if not user:
            return Response([])
        customer = _get_customer(user)
        if not customer:
            return Response([])
        items = ListWishlistItemsUseCase(_wishlist_repository()).execute(customer)
        return Response(WishlistItemSerializer(items, many=True).data)

    def post(self, request):
        user = request.user
        if not user:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        customer = _get_customer(user)
        if not customer:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        try:
            item = AddWishlistItemUseCase(_wishlist_repository()).execute(customer, request.data.get('product_id'))
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(WishlistItemSerializer(item).data, status=status.HTTP_201_CREATED)


class WishlistItemAPIView(APIView):
    permission_classes = [IsCustomer]

    def delete(self, request, product_id):
        customer = _get_customer(request.user)
        if not customer:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        deleted = DeleteWishlistItemUseCase(_wishlist_repository()).execute(customer, product_id)
        if not deleted:
            return Response({'detail': 'Wishlist item not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)
