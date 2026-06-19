from __future__ import annotations

from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.models import Product, UserInteraction, WishlistItem


class DjangoOrmWishlistRepository:
    def list_items(self, customer):
        return (
            WishlistItem.objects.filter(user=customer)
            .select_related('product', 'product__category', 'product__brand')
            .prefetch_related('product__images', 'product__variants')
        )

    def add_item(self, customer, product_id):
        if WishlistItem.objects.filter(user=customer).count() >= 100:
            raise BusinessRuleViolation('Danh sach yeu thich toi da 100 san pham')
        product = Product.objects.filter(product_id=product_id, status='active').first()
        if product is None:
            raise NotFoundError('Product not found')
        item, created = WishlistItem.objects.get_or_create(user=customer, product=product)
        if created:
            UserInteraction.objects.create(user=customer, product=product, interaction_type='wishlist_add', score=2.5)
        return item
