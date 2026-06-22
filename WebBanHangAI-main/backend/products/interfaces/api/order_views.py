from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.customer_context import get_customer_for_user
from products.application.orders.dto import CancelOrderDTO, OrderListFilterDTO, UpdateOrderStatusDTO
from products.application.orders.use_cases import (
    CancelCustomerOrderUseCase,
    ConfirmCustomerOrderReceivedUseCase,
    GetAdminOrderDetailUseCase,
    GetCustomerOrderDetailUseCase,
    GetCustomerOrderUseCase,
    ListAdminOrdersUseCase,
    ListCustomerOrdersUseCase,
    ListStaffOrdersUseCase,
    UpdateOrderStatusUseCase,
)
from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.infrastructure.django_orm.order_repository import DjangoOrmOrderRepository
from products.security.permissions import CanProcessOrders, IsAdmin, IsCustomer
from products.serializers import OrderSerializer
from products.business.serializers import OrderDetailSerializer


def _order_repository() -> DjangoOrmOrderRepository:
    return DjangoOrmOrderRepository()


def _get_customer(user):
    return get_customer_for_user(user)


class CustomerOrderListAPIView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        customer = _get_customer(request.user)
        if not customer:
            return Response([])
        orders = ListCustomerOrdersUseCase(_order_repository()).execute(customer)
        return Response(OrderDetailSerializer(orders, many=True).data)


class CustomerOrderAPIView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request, order_id):
        customer = _get_customer(request.user)
        order = GetCustomerOrderUseCase(_order_repository()).execute(customer, order_id)
        if order is None:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrderDetailSerializer(order).data)


class CustomerOrderCancelAPIView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, order_id):
        user = request.user
        customer = _get_customer(user)
        try:
            order = CancelCustomerOrderUseCase(_order_repository()).execute(
                user,
                customer,
                order_id,
                CancelOrderDTO.from_payload(request.data),
            )
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order).data)


class CustomerOrderConfirmReceivedAPIView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request, order_id):
        customer = _get_customer(request.user)
        try:
            order = ConfirmCustomerOrderReceivedUseCase(_order_repository()).execute(
                request.user,
                customer,
                order_id,
            )
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order).data)


class CustomerOrderDetailAPIView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request, order_id):
        customer = _get_customer(request.user)
        order = GetCustomerOrderDetailUseCase(_order_repository()).execute(customer, order_id)
        if order is None:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrderDetailSerializer(order).data)


class StaffOrderListAPIView(APIView):
    permission_classes = [CanProcessOrders]

    def get(self, request):
        filters = OrderListFilterDTO.from_query_params(request.query_params)
        orders = ListStaffOrdersUseCase(_order_repository()).execute(filters)
        return Response(OrderDetailSerializer(orders, many=True).data)


class StaffOrderStatusAPIView(APIView):
    permission_classes = [CanProcessOrders]

    def put(self, request, order_id):
        try:
            order = UpdateOrderStatusUseCase(_order_repository()).execute(
                request.user,
                order_id,
                UpdateOrderStatusDTO.from_payload(request.data),
            )
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order).data)


class AdminOrderListAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        filters = OrderListFilterDTO.from_query_params(request.query_params)
        orders = ListAdminOrdersUseCase(_order_repository()).execute(filters)
        return Response(OrderDetailSerializer(orders, many=True).data)


class AdminOrderDetailAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, order_id):
        order = GetAdminOrderDetailUseCase(_order_repository()).execute(order_id)
        if order is None:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrderDetailSerializer(order).data)
