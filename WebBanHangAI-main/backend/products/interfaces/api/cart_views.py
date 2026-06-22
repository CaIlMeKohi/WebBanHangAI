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
from products.application.customer_context import get_customer_for_user
from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.infrastructure.django_orm.cart_repository import DjangoOrmCartRepository
from products.security.permissions import IsCustomer
from products.serializers import CartItemSerializer


def _cart_repository() -> DjangoOrmCartRepository:
    return DjangoOrmCartRepository()


def _get_customer(user):
    return get_customer_for_user(user)


class CartAPIView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        customer = _get_customer(request.user)
        if not customer:
            return Response([])
        items = ListCartItemsUseCase(_cart_repository()).execute(customer)
        return Response(CartItemSerializer(items, many=True).data)

    def post(self, request):
        customer = _get_customer(request.user)
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
    permission_classes = [IsCustomer]

    def put(self, request, item_id):
        customer = _get_customer(request.user)
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
        customer = _get_customer(request.user)
        DeleteCartItemUseCase(_cart_repository()).execute(customer, item_id)
        return Response(status=status.HTTP_204_NO_CONTENT)
