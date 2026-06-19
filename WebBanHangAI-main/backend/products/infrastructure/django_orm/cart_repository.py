from __future__ import annotations

from products.application.cart_service import get_customer_cart_items, get_or_create_cart
from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.infrastructure.stored_procedures import check_variant_stock
from products.models import CartItem, Product, UserInteraction


def _available_stock(product, variant=None):
    if variant is not None:
        stock = check_variant_stock(variant.variant_id, 1)
        if stock is not None and 'available_stock' in stock:
            return max(0, int(stock['available_stock']))
        return max(0, variant.stock_quantity - variant.stock_reserved)
    return sum(max(0, item.stock_quantity - item.stock_reserved) for item in product.variants.all())


def _variant_label(variant):
    if variant is None:
        return 'mac dinh'
    size = variant.size or 'STD'
    color = variant.color or 'Mac dinh'
    return f'{size}/{color}'


class DjangoOrmCartRepository:
    def list_items(self, customer):
        return get_customer_cart_items(customer)

    def add_item(self, customer, payload):
        product = Product.objects.filter(product_id=payload.get('product_id'), status='active').first()
        if product is None:
            raise NotFoundError('Product not found')

        variant = self._resolve_variant(product, payload)
        if variant is None:
            raise BusinessRuleViolation('San pham chua co SKU hop le')

        quantity = max(1, int(payload.get('quantity', 1)))
        if _available_stock(product, variant) < quantity:
            raise BusinessRuleViolation(f'Khong du ton kho cho bien the {_variant_label(variant)}')

        cart = get_or_create_cart(customer)
        item, created = CartItem.objects.get_or_create(
            cart=cart,
            variant=variant,
            defaults={'quantity': quantity},
        )
        if not created:
            if _available_stock(product, variant) < item.quantity + quantity:
                raise BusinessRuleViolation(f'Khong du ton kho cho bien the {_variant_label(variant)}')
            item.quantity += quantity
            item.save(update_fields=['quantity'])

        UserInteraction.objects.create(user=customer, product=product, interaction_type='add_to_cart', score=3.0)
        return item

    def update_item_quantity(self, customer, item_id: int, quantity: int):
        item = (
            CartItem.objects.filter(cart_item_id=item_id, cart__customer=customer)
            .select_related('variant', 'variant__product')
            .first()
        )
        if item is None:
            raise NotFoundError('Cart item not found')
        next_quantity = max(1, int(quantity))
        if _available_stock(item.product, item.variant) < next_quantity:
            raise BusinessRuleViolation(f'Khong du ton kho cho bien the {_variant_label(item.variant)}')
        item.quantity = next_quantity
        item.save(update_fields=['quantity'])
        return item

    def delete_item(self, customer, item_id: int) -> None:
        CartItem.objects.filter(cart_item_id=item_id, cart__customer=customer).delete()

    def _resolve_variant(self, product, payload):
        variants = product.variants.filter(is_active=True)
        requested_variant_id = payload.get('variant_id')
        if requested_variant_id:
            variant = variants.filter(variant_id=requested_variant_id).first()
            if variant is not None:
                return variant
        size = payload.get('size')
        color = payload.get('color')
        for candidate in variants:
            if (not size or candidate.size == size) and (not color or candidate.color == color):
                return candidate
        return variants.first()
