from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from products.tests.factories import auth_headers, create_cart_item, create_coupon, create_customer_user, create_product


class CouponApiTests(APITestCase):
    def setUp(self):
        self.user, self.customer = create_customer_user()
        self.product = create_product(price=100000, stock=10)
        self.variant = self.product.variants.first()
        self.item = create_cart_item(self.customer, self.variant, quantity=2)

    def test_apply_fixed_coupon(self):
        coupon = create_coupon(code="FIXED10", discount_type="fixed", discount_value=10000)

        response = self.client.post(
            "/api/products/cart/apply-coupon/",
            {"user_id": self.user.user_id, "code": coupon.code},
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["subtotal"], 200000)
        self.assertEqual(response.data["discount_amount"], 10000)
        self.assertEqual(response.data["final_amount"], 190000)
        self.assertEqual(response.data["coupon"]["code"], coupon.code)

    def test_apply_percentage_coupon(self):
        coupon = create_coupon(code="PCT10", discount_type="percentage", discount_value=10)

        response = self.client.post(
            "/api/products/cart/apply-coupon/",
            {"user_id": self.user.user_id, "code": coupon.code},
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["discount_amount"], 20000)

    def test_inactive_coupon_returns_error_not_500(self):
        coupon = create_coupon(code="INACTIVE", is_active=False)

        response = self.client.post(
            "/api/products/cart/apply-coupon/",
            {"user_id": self.user.user_id, "code": coupon.code},
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_expired_coupon_returns_error_not_500(self):
        coupon = create_coupon(code="EXPIRED", end_at=timezone.now() - timezone.timedelta(days=1))

        response = self.client.post(
            "/api/products/cart/apply-coupon/",
            {"user_id": self.user.user_id, "code": coupon.code},
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_min_order_not_met_returns_error_not_500(self):
        coupon = create_coupon(code="MIN500", min_order_amount=500000)

        response = self.client.post(
            "/api/products/cart/apply-coupon/",
            {"user_id": self.user.user_id, "code": coupon.code},
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)
