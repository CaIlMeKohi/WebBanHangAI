from __future__ import annotations

from products.models import Cart, CartItem, Customer


def get_customer_cart_items(customer: Customer):
    return (
        CartItem.objects.filter(cart__customer=customer)
        .select_related(
            'cart',
            'variant',
            'variant__product',
            'variant__product__category',
            'variant__product__brand',
        )
        .prefetch_related('variant__product__images', 'variant__product__variants')
    )


def get_or_create_cart(customer: Customer) -> Cart:
    cart, _ = Cart.objects.get_or_create(customer=customer)
    return cart
