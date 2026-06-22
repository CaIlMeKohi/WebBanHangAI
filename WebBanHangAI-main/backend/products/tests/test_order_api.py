from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from products.models import CartItem, CouponUsage, Order, Payment
from products.tests.factories import (
    auth_headers,
    create_address,
    create_cart_item,
    create_coupon,
    create_customer_user,
    create_order,
    create_order_item,
    create_product,
    create_staff_user,
)


class OrderApiTests(APITestCase):
    def setUp(self):
        self.user, self.customer = create_customer_user()
        self.address = create_address(self.customer)
        self.product = create_product(price=100000, stock=10)
        self.variant = self.product.variants.first()

    @patch("products.infrastructure.django_orm.order_repository.send_order_confirmation", return_value={"skipped": True})
    @patch("products.infrastructure.django_orm.order_repository.decrease_variant_stock", return_value=True)
    @patch("products.infrastructure.django_orm.order_repository.check_variant_stock", return_value={"available_stock": 10})
    def test_create_cod_order_from_cart(self, _stock, _decrease, _email):
        item = create_cart_item(self.customer, self.variant, quantity=2)

        response = self.client.post(
            "/api/products/orders/",
            {"user_id": self.user.user_id, "payment_method": "cod", "cart_item_ids": [item.cart_item_id]},
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["payment_method"], "cod")
        self.assertEqual(response.data["payment_status"], "unpaid")
        self.assertEqual(len(response.data["items"]), 1)
        self.assertFalse(CartItem.objects.filter(cart_item_id=item.cart_item_id).exists())
        self.assertTrue(Payment.objects.filter(order_id=response.data["order_id"], status="pending").exists())

    @patch("products.infrastructure.django_orm.order_repository.send_order_confirmation", return_value={"skipped": True})
    @patch("products.infrastructure.django_orm.order_repository.decrease_variant_stock", return_value=True)
    @patch("products.infrastructure.django_orm.order_repository.check_variant_stock", return_value={"available_stock": 10})
    def test_create_order_with_coupon_records_usage(self, _stock, _decrease, _email):
        create_cart_item(self.customer, self.variant, quantity=1)
        coupon = create_coupon(code="ORDER10", discount_type="fixed", discount_value=10000)

        response = self.client.post(
            "/api/products/orders/",
            {"user_id": self.user.user_id, "payment_method": "cod", "coupon_code": coupon.code},
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["discount_amount"], "10000.00")
        self.assertTrue(CouponUsage.objects.filter(coupon=coupon, user=self.customer).exists())

    def test_customer_cancel_pending_order(self):
        order = create_order(customer=self.customer, address=self.address, status="pending")

        def cancel_sp(order_id, actor_user_id=None, reason="", restore_stock=False):
            Order.objects.filter(order_id=order_id).update(status="cancelled")
            return []

        with patch("products.infrastructure.django_orm.order_repository.cancel_order_and_restore_stock", side_effect=cancel_sp):
            response = self.client.post(
                f"/api/products/orders/{order.order_id}/cancel/",
                {"user_id": self.user.user_id, "reason": "Changed mind"},
                format="json",
                **auth_headers(self.user),
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "cancelled")

    def test_customer_cancel_delivered_order_is_blocked(self):
        order = create_order(customer=self.customer, address=self.address, status="delivered")

        response = self.client.post(
            f"/api/products/orders/{order.order_id}/cancel/",
            {"user_id": self.user.user_id, "reason": "Too late"},
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)


class StaffOrderStatusApiTests(APITestCase):
    def setUp(self):
        self.staff_user, _staff = create_staff_user()
        self.customer_user, self.customer = create_customer_user()
        self.order = create_order(customer=self.customer, status="pending")
        product = create_product()
        create_order_item(self.order, product=product, variant=product.variants.first())

    def test_staff_confirm_order(self):
        def update_sp(order_id, next_status, actor_user_id=None, carrier_name=None):
            Order.objects.filter(order_id=order_id).update(status=next_status)
            return []

        with patch("products.business.views.update_order_status", side_effect=update_sp):
            response = self.client.put(
                f"/api/staff/orders/{self.order.order_id}/confirm",
                {},
                format="json",
                **auth_headers(self.staff_user),
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "confirmed")

    def test_staff_update_status_valid_transition(self):
        self.order.status = "confirmed"
        self.order.save(update_fields=["status"])

        def update_sp(order_id, next_status, actor_user_id=None, carrier_name=None):
            Order.objects.filter(order_id=order_id).update(status=next_status)
            return []

        with patch("products.infrastructure.django_orm.order_repository.update_order_status", side_effect=update_sp):
            response = self.client.put(
                f"/api/products/staff/orders/{self.order.order_id}/status/",
                {"status": "processing"},
                format="json",
                **auth_headers(self.staff_user),
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "processing")

    def test_staff_update_status_invalid_transition(self):
        response = self.client.put(
            f"/api/products/staff/orders/{self.order.order_id}/status/",
            {"status": "delivered"},
            format="json",
            **auth_headers(self.staff_user),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)
