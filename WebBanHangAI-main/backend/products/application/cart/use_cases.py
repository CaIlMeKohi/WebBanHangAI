from __future__ import annotations

from products.application.cart.dto import AddCartItemDTO, UpdateCartItemDTO
from products.application.ports.repositories.cart_repository import CartRepository


class ListCartItemsUseCase:
    def __init__(self, repository: CartRepository):
        self.repository = repository

    def execute(self, customer):
        return self.repository.list_items(customer)


class AddCartItemUseCase:
    def __init__(self, repository: CartRepository):
        self.repository = repository

    def execute(self, customer, dto: AddCartItemDTO):
        return self.repository.add_item(customer, dto.as_payload())


class UpdateCartItemUseCase:
    def __init__(self, repository: CartRepository):
        self.repository = repository

    def execute(self, customer, item_id: int, dto: UpdateCartItemDTO):
        return self.repository.update_item_quantity(customer, item_id, dto.quantity)


class DeleteCartItemUseCase:
    def __init__(self, repository: CartRepository):
        self.repository = repository

    def execute(self, customer, item_id: int) -> None:
        self.repository.delete_item(customer, item_id)
