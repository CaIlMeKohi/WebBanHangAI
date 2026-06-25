from __future__ import annotations

from products.application.orders.dto import CancelOrderDTO, CreateOrderDTO, OrderListFilterDTO, UpdateOrderStatusDTO
from products.application.ports.repositories.order_repository import OrderRepository


class ListCustomerOrdersUseCase:
    def __init__(self, repository: OrderRepository):
        self.repository = repository

    def execute(self, customer):
        return self.repository.list_customer_orders(customer)


class GetCustomerOrderUseCase:
    def __init__(self, repository: OrderRepository):
        self.repository = repository

    def execute(self, customer, order_id: int):
        return self.repository.get_customer_order(customer, order_id)


class GetCustomerOrderDetailUseCase:
    def __init__(self, repository: OrderRepository):
        self.repository = repository

    def execute(self, customer, order_id: int):
        return self.repository.get_customer_order_detail(customer, order_id)


class ListStaffOrdersUseCase:
    def __init__(self, repository: OrderRepository):
        self.repository = repository

    def execute(self, filters: OrderListFilterDTO):
        return self.repository.list_staff_orders(filters.as_dict())


class ListAdminOrdersUseCase:
    def __init__(self, repository: OrderRepository):
        self.repository = repository

    def execute(self, filters: OrderListFilterDTO):
        return self.repository.list_admin_orders(filters.as_dict())


class GetAdminOrderDetailUseCase:
    def __init__(self, repository: OrderRepository):
        self.repository = repository

    def execute(self, order_id: int):
        return self.repository.get_admin_order_detail(order_id)


class CreateCustomerOrderUseCase:
    def __init__(self, repository: OrderRepository):
        self.repository = repository

    def execute(self, user, customer, dto: CreateOrderDTO):
        return self.repository.create_customer_order(user, customer, dto)


class CancelCustomerOrderUseCase:
    def __init__(self, repository: OrderRepository):
        self.repository = repository

    def execute(self, user, customer, order_id: int, dto: CancelOrderDTO):
        return self.repository.cancel_customer_order(user, customer, order_id, dto)


class ConfirmCustomerOrderReceivedUseCase:
    def __init__(self, repository: OrderRepository):
        self.repository = repository

    def execute(self, user, customer, order_id: int):
        return self.repository.confirm_customer_order_received(user, customer, order_id)


class UpdateOrderStatusUseCase:
    def __init__(self, repository: OrderRepository):
        self.repository = repository

    def execute(self, actor, order_id: int, dto: UpdateOrderStatusDTO):
        return self.repository.update_order_status(actor, order_id, dto)
