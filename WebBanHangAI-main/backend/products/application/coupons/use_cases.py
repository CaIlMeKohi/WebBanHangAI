from __future__ import annotations

from products.application.coupons.dto import ApplyCouponDTO
from products.application.ports.repositories.coupon_repository import CouponRepository


class ApplyCouponUseCase:
    def __init__(self, repository: CouponRepository):
        self.repository = repository

    def execute(self, customer, dto: ApplyCouponDTO):
        return self.repository.apply_to_cart(customer, dto.code, dto.cart_item_ids)
