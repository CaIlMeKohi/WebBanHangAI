from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.coupons.dto import ApplyCouponDTO
from products.application.coupons.use_cases import ApplyCouponUseCase
from products.application.customer_context import get_active_user, get_customer_for_user
from products.domain.common.exceptions import BusinessRuleViolation
from products.infrastructure.django_orm.coupon_repository import DjangoOrmCouponRepository
from products.serializers import CouponSerializer


def _coupon_repository() -> DjangoOrmCouponRepository:
    return DjangoOrmCouponRepository()


def _get_user(request):
    if getattr(getattr(request, 'user', None), 'user_id', None):
        return request.user
    user_id = request.query_params.get('user_id') or getattr(request, 'data', {}).get('user_id')
    if not user_id:
        return None
    return get_active_user(user_id)


def _get_customer(user):
    return get_customer_for_user(user)


class ApplyCouponAPIView(APIView):
    def get(self, request):
        customer = _get_customer(_get_user(request))
        if not customer:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        raw_ids = request.query_params.get('cart_item_ids', '').strip()
        cart_item_ids = [int(item_id) for item_id in raw_ids.split(',') if item_id.strip().isdigit()] or None
        results = _coupon_repository().list_available_for_cart(customer, cart_item_ids)
        return Response([
            {
                'coupon': CouponSerializer(result['coupon']).data,
                'subtotal': result['subtotal'],
                'discount_amount': result['discount_amount'],
                'final_amount': result['final_amount'],
            }
            for result in results
        ])

    def post(self, request):
        customer = _get_customer(_get_user(request))
        if not customer:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        try:
            result = ApplyCouponUseCase(_coupon_repository()).execute(
                customer,
                ApplyCouponDTO.from_payload(request.data),
            )
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'coupon': CouponSerializer(result['coupon']).data,
            'subtotal': result['subtotal'],
            'discount_amount': result['discount_amount'],
            'final_amount': result['final_amount'],
        })
