from __future__ import annotations

from products.application.ports.repositories.return_repository import ReturnRepository
from products.application.returns.dto import CreateReturnRequestDTO


class ListCustomerReturnsUseCase:
    def __init__(self, repository: ReturnRepository):
        self.repository = repository

    def execute(self, customer):
        return self.repository.list_customer_returns(customer)


class CreateReturnRequestUseCase:
    def __init__(self, repository: ReturnRepository):
        self.repository = repository

    def execute(self, customer, dto: CreateReturnRequestDTO):
        return self.repository.create_return_request(customer, {
            'order_id': dto.order_id,
            'order_item_id': dto.order_item_id,
            'reason': dto.reason,
            'desired_solution': dto.desired_solution,
            'images': dto.images,
        })


class ListStaffReturnsUseCase:
    def __init__(self, repository: ReturnRepository):
        self.repository = repository

    def execute(self):
        return self.repository.list_staff_returns()
