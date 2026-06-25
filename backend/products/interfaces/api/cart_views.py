from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.cart.dto import AddCartItemDTO, UpdateCartItemDTO
from products.application.cart.use_cases import (
    AddCartItemUseCase,
    DeleteCartItemUseCase,
    ListCartItemsUseCase,
    UpdateCartItemUseCase,
)
from products.application.customer_context import get_active_user, get_customer_for_user
from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.infrastructure.django_orm.cart_repository import DjangoOrmCartRepository
from products.serializers import CartItemSerializer


def _cart_repository() -> DjangoOrmCartRepository:
    return DjangoOrmCartRepository()


def _get_user(request):
    if getattr(getattr(request, 'user', None), 'user_id', None):
        return request.user
    user_id = request.query_params.get('user_id') or getattr(request, 'data', {}).get('user_id')
    if not user_id:
        return None
    return get_active_user(user_id)


def _get_customer(user):
    return get_customer_for_user(user)


class CartAPIView(APIView):
    def get(self, request):
        customer = _get_customer(_get_user(request))
        if not customer:
            return Response([])
        items = ListCartItemsUseCase(_cart_repository()).execute(customer)
        return Response(CartItemSerializer(items, many=True).data)

    def post(self, request):
        customer = _get_customer(_get_user(request))
        if not customer:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        try:
            item = AddCartItemUseCase(_cart_repository()).execute(
                customer,
                AddCartItemDTO.from_payload(request.data),
            )
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CartItemSerializer(item).data, status=status.HTTP_201_CREATED)


class CartItemAPIView(APIView):
    def put(self, request, item_id):
        customer = _get_customer(_get_user(request))
        try:
            item = UpdateCartItemUseCase(_cart_repository()).execute(
                customer,
                item_id,
                UpdateCartItemDTO.from_payload(request.data),
            )
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(CartItemSerializer(item).data)

    def delete(self, request, item_id):
        customer = _get_customer(_get_user(request))
        DeleteCartItemUseCase(_cart_repository()).execute(customer, item_id)
        return Response(status=status.HTTP_204_NO_CONTENT)
