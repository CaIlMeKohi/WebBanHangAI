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
    cart = Cart.objects.filter(customer=customer).order_by('-updated_at', '-cart_id').first()
    if cart is not None:
        duplicate_carts = Cart.objects.filter(customer=customer).exclude(cart_id=cart.cart_id)
        for duplicate in duplicate_carts.prefetch_related('items'):
            for item in duplicate.items.all():
                existing = CartItem.objects.filter(cart=cart, variant=item.variant).first()
                if existing:
                    existing.quantity += item.quantity
                    existing.save(update_fields=['quantity', 'updated_at'])
                    item.delete()
                else:
                    item.cart = cart
                    item.save(update_fields=['cart', 'updated_at'])
            duplicate.delete()
        return cart
    return Cart.objects.create(customer=customer)
