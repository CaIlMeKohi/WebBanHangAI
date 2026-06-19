from __future__ import annotations

from django.utils import timezone

from products.application.cart_service import get_customer_cart_items
from products.domain.common.exceptions import BusinessRuleViolation
from products.models import Coupon, CouponUsage


def _coupon_eligible_subtotal(coupon, cart_items):
    if not coupon.product_id and not coupon.category_id:
        return None
    eligible_subtotal = 0
    for item in cart_items:
        product = item.product
        if coupon.product_id and product.product_id != coupon.product_id:
            continue
        if coupon.category_id:
            category = product.category
            category_ids = {category.category_id}
            if category.parent_id:
                category_ids.add(category.parent_id)
            if coupon.category_id not in category_ids:
                continue
        price = int(item.variant.price if item.variant_id else product.base_price)
        eligible_subtotal += price * item.quantity
    return eligible_subtotal


def _calculate_discount(coupon, customer, subtotal, cart_items):
    if coupon.expiry_date and coupon.expiry_date < timezone.localdate():
        raise BusinessRuleViolation('Coupon da het han')
    if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
        raise BusinessRuleViolation('Coupon da het luot su dung')
    if CouponUsage.objects.filter(coupon=coupon, user=customer).count() >= coupon.per_customer_limit:
        raise BusinessRuleViolation('Ban da het luot su dung coupon nay')
    if subtotal < coupon.min_order_amount:
        raise BusinessRuleViolation('Don hang chua dat gia tri toi thieu')

    discount_base = subtotal
    scoped_subtotal = _coupon_eligible_subtotal(coupon, cart_items)
    if scoped_subtotal is not None:
        if scoped_subtotal <= 0:
            raise BusinessRuleViolation('Coupon khong ap dung cho san pham da chon')
        discount_base = scoped_subtotal

    if coupon.discount_type == 'percentage':
        discount = discount_base * coupon.discount_value // 100
        if coupon.max_discount:
            discount = min(discount, coupon.max_discount)
    else:
        discount = coupon.discount_value
    return min(discount, discount_base)


class DjangoOrmCouponRepository:
    def apply_to_cart(self, customer, code: str, cart_item_ids: list[int] | None = None):
        coupon_code = str(code or '').strip().upper()
        if not coupon_code:
            raise BusinessRuleViolation('Coupon khong hop le')

        coupon = Coupon.objects.filter(code__iexact=coupon_code, is_active=True).first()
        if coupon is None:
            raise BusinessRuleViolation('Coupon khong hop le')

        cart_items = get_customer_cart_items(customer)
        if cart_item_ids:
            cart_items = cart_items.filter(cart_item_id__in=cart_item_ids)
        cart_items = list(cart_items)
        subtotal = sum(int(item.variant.price if item.variant_id else item.product.base_price) * item.quantity for item in cart_items)
        discount = _calculate_discount(coupon, customer, subtotal, cart_items)
        return {
            'coupon': coupon,
            'subtotal': subtotal,
            'discount_amount': discount,
            'final_amount': max(0, subtotal - discount),
        }
