from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.coupons.dto import ApplyCouponDTO
from products.application.coupons.use_cases import ApplyCouponUseCase
from products.application.customer_context import get_customer_for_user
from products.domain.common.exceptions import BusinessRuleViolation
from products.infrastructure.django_orm.coupon_repository import DjangoOrmCouponRepository
from products.security.permissions import IsCustomer
from products.serializers import CouponSerializer


def _coupon_repository() -> DjangoOrmCouponRepository:
    return DjangoOrmCouponRepository()


def _get_customer(user):
    return get_customer_for_user(user)


class ApplyCouponAPIView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request):
        customer = _get_customer(request.user)
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
