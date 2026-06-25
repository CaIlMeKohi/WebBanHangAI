from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.customer_context import get_active_user, get_customer_for_user
from products.application.wishlist.use_cases import AddWishlistItemUseCase, ListWishlistItemsUseCase
from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.infrastructure.django_orm.wishlist_repository import DjangoOrmWishlistRepository
from products.serializers import WishlistItemSerializer


def _wishlist_repository() -> DjangoOrmWishlistRepository:
    return DjangoOrmWishlistRepository()


def _get_user(request):
    if getattr(getattr(request, 'user', None), 'user_id', None):
        return request.user
    user_id = request.query_params.get('user_id') or getattr(request, 'data', {}).get('user_id')
    if not user_id:
        return None
    return get_active_user(user_id)


def _get_customer(user):
    return get_customer_for_user(user)


class WishlistAPIView(APIView):
    def get(self, request):
        user = _get_user(request)
        if not user:
            return Response([])
        customer = _get_customer(user)
        if not customer:
            return Response([])
        items = ListWishlistItemsUseCase(_wishlist_repository()).execute(customer)
        return Response(WishlistItemSerializer(items, many=True).data)

    def post(self, request):
        user = _get_user(request)
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
