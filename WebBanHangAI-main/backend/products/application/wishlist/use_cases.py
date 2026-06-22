from __future__ import annotations

from products.application.ports.repositories.wishlist_repository import WishlistRepository


class ListWishlistItemsUseCase:
    def __init__(self, repository: WishlistRepository):
        self.repository = repository

    def execute(self, customer):
        return self.repository.list_items(customer)


class AddWishlistItemUseCase:
    def __init__(self, repository: WishlistRepository):
        self.repository = repository

    def execute(self, customer, product_id):
        return self.repository.add_item(customer, product_id)
