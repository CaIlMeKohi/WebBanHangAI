from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from products.models import CartItem, CouponUsage, Order, Payment
from products.services.order_lifecycle import expire_pending_online_orders
from products.tests.factories import (
    auth_headers,
    create_admin_user,
    create_address,
    create_cart_item,
    create_coupon,
    create_customer_user,
    create_order,
    create_order_item,
    create_payment,
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

    @patch("products.infrastructure.django_orm.order_repository.send_order_confirmation", return_value={"skipped": True})
    @patch("products.infrastructure.django_orm.order_repository.decrease_variant_stock", return_value=True)
    @patch("products.infrastructure.django_orm.order_repository.check_variant_stock", return_value={"available_stock": 10})
    def test_checkout_token_prevents_duplicate_order(self, _stock, _decrease, _email):
        item = create_cart_item(self.customer, self.variant, quantity=1)
        payload = {
            "payment_method": "cod",
            "cart_item_ids": [item.cart_item_id],
            "checkout_token": "checkout-token-123",
        }

        first = self.client.post(
            "/api/products/orders/",
            payload,
            format="json",
            **auth_headers(self.user),
        )
        second = self.client.post(
            "/api/products/orders/",
            payload,
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(first.data["order_id"], second.data["order_id"])
        self.assertEqual(Order.objects.filter(checkout_token="checkout-token-123").count(), 1)

    def test_customer_cancel_pending_order(self):
        order = create_order(customer=self.customer, address=self.address, status="pending")

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

    def test_cancel_paid_order_marks_refund_pending(self):
        order = create_order(
            customer=self.customer,
            address=self.address,
            status="pending",
            payment_method="bank_transfer",
            payment_status="paid",
        )
        create_order_item(order, product=self.product, variant=self.variant)
        payment = Payment.objects.create(
            order=order,
            amount=order.final_amount,
            payment_method="bank_transfer",
            status="success",
        )

        response = self.client.post(
            f"/api/products/orders/{order.order_id}/cancel/",
            {"reason": "Changed mind"},
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(order.payment_status, "refund_pending")
        self.assertEqual(payment.status, "refund_pending")

    def test_expired_online_order_is_cancelled_and_stock_restored(self):
        order = create_order(
            customer=self.customer,
            address=self.address,
            status="pending",
            payment_method="bank_transfer",
            payment_status="pending",
        )
        order.payment_expires_at = timezone.now() - timedelta(minutes=1)
        order.save(update_fields=["payment_expires_at"])
        self.variant.stock_quantity = 9
        self.variant.save(update_fields=["stock_quantity"])
        create_order_item(order, product=self.product, variant=self.variant)
        payment = Payment.objects.create(
            order=order,
            amount=order.final_amount,
            payment_method="bank_transfer",
            status="pending",
        )

        self.assertEqual(expire_pending_online_orders(), 1)

        order.refresh_from_db()
        payment.refresh_from_db()
        self.variant.refresh_from_db()
        self.assertEqual(order.status, "cancelled")
        self.assertEqual(order.payment_status, "expired")
        self.assertEqual(payment.status, "expired")
        self.assertEqual(self.variant.stock_quantity, 10)


class StaffOrderStatusApiTests(APITestCase):
    def setUp(self):
        self.staff_user, _staff = create_staff_user()
        self.customer_user, self.customer = create_customer_user()
        self.order = create_order(customer=self.customer, status="pending")
        product = create_product()
        create_order_item(self.order, product=product, variant=product.variants.first())

    def test_staff_confirm_order(self):
        def update_sp(order_id, next_status, *args, **kwargs):
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

        def update_sp(order_id, next_status, *args, **kwargs):
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

    def test_staff_cannot_process_unpaid_online_order(self):
        self.order.payment_method = "bank_transfer"
        self.order.payment_status = "pending"
        self.order.save(update_fields=["payment_method", "payment_status"])

        response = self.client.put(
            f"/api/products/staff/orders/{self.order.order_id}/status/",
            {"status": "confirmed"},
            format="json",
            **auth_headers(self.staff_user),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("chua duoc thanh toan", response.data["detail"])


class AdminRefundApiTests(APITestCase):
    def setUp(self):
        self.admin_user, _admin = create_admin_user()
        _customer_user, self.customer = create_customer_user()
        self.order = create_order(
            customer=self.customer,
            status="cancelled",
            payment_method="bank_transfer",
            payment_status="refund_pending",
        )
        self.payment = create_payment(self.order, status="refund_pending")

    def test_admin_can_complete_manual_refund_with_reference(self):
        response = self.client.post(
            f"/api/admin/orders/{self.order.order_id}/refund/complete",
            {"refund_reference": "REFUND-123"},
            format="json",
            **auth_headers(self.admin_user),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.order.refresh_from_db()
        self.payment.refresh_from_db()
        self.assertEqual(self.order.payment_status, "refunded")
        self.assertEqual(self.payment.status, "refunded")
        self.assertEqual(self.payment.refund_reference, "REFUND-123")
