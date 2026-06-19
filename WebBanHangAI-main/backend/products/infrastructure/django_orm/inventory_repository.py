from __future__ import annotations

from django.db import DatabaseError

from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.infrastructure.stored_procedures import adjust_variant_stock, low_stock_variants
from products.models import ProductVariant


class DjangoOrmInventoryRepository:
    def adjust_variant_stock(self, actor, payload):
        variant = ProductVariant.objects.filter(variant_id=payload.variant_id).first()
        if variant is None:
            raise NotFoundError('Variant not found')
        if not payload.reason:
            raise BusinessRuleViolation('Bat buoc nhap ly do dieu chinh kho')
        try:
            adjust_variant_stock(
                variant_id=variant.variant_id,
                change_quantity=payload.change_quantity,
                staff_user_id=actor.user_id,
                action_type='import' if payload.change_quantity > 0 else 'adjust',
                reason=payload.reason[:500],
            )
        except DatabaseError as exc:
            raise BusinessRuleViolation('Khong the dieu chinh kho. Vui long kiem tra so luong va thu lai.') from exc
        variant.refresh_from_db()
        return variant

    def list_low_stock(self):
        return low_stock_variants()

    def list_stock_variants(self):
        variants = (
            ProductVariant.objects
            .select_related('product')
            .filter(is_active=True, product__status='active')
            .order_by('product__name', 'color', 'size', 'sku')
        )
        return [
            {
                'variant_id': variant.variant_id,
                'product_id': variant.product_id,
                'product_name': variant.product.name,
                'sku': variant.sku,
                'color': variant.color,
                'size': variant.size,
                'stock_quantity': variant.stock_quantity,
                'stock_reserved': variant.stock_reserved,
                'available_stock': max(0, variant.stock_quantity - variant.stock_reserved),
            }
            for variant in variants
        ]
