import hashlib
import hmac
import json
from datetime import timedelta
from unittest.mock import patch

from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from products.models import Notification, Order, PaymentWebhookLog
from products.services.payos_service import InvalidPayOSWebhook, verify_payos_webhook
from products.tests.factories import auth_headers, create_customer_user, create_order, create_order_item, create_payment, create_product


PAYOS_LINK = {
    "checkout_url": "https://pay.payos.vn/web/test-link",
    "qr_code": "000201010212",
    "payment_link_id": "payos-link-123",
    "order_code": 1,
    "amount": 130000,
    "status": "PENDING",
}

PAYOS_STATUS_PENDING = {
    "payment_link_id": "payos-link-123",
    "order_code": 1,
    "amount": 130000,
    "amount_paid": 0,
    "amount_remaining": 130000,
    "status": "PENDING",
    "transaction_id": None,
}


class PaymentApiTests(APITestCase):
    @override_settings(
        PAYOS_CLIENT_ID="client-id",
        PAYOS_API_KEY="api-key",
        PAYOS_CHECKSUM_KEY="checksum-key",
    )
    def test_payos_sdk_verifies_signed_webhook(self):
        data = {
            "orderCode": 123,
            "amount": 130000,
            "description": "DH123",
            "accountNumber": "12345678",
            "reference": "TX123",
            "transactionDateTime": "2026-06-23 10:00:00",
            "currency": "VND",
            "paymentLinkId": "payos-link-123",
            "code": "00",
            "desc": "success",
            "counterAccountBankId": "",
            "counterAccountBankName": "",
            "counterAccountName": "",
            "counterAccountNumber": "",
            "virtualAccountName": "",
            "virtualAccountNumber": "",
        }
        signed_data = "&".join(f"{key}={data[key]}" for key in sorted(data))
        signature = hmac.new(b"checksum-key", signed_data.encode(), hashlib.sha256).hexdigest()

        result = verify_payos_webhook(
            json.dumps(
                {
                    "code": "00",
                    "desc": "success",
                    "success": True,
                    "data": data,
                    "signature": signature,
                }
            ).encode()
        )

        self.assertEqual(result["order_id"], 123)
        self.assertEqual(result["transaction_id"], "TX123")
        self.assertTrue(result["success"])

    @patch(
        "products.infrastructure.django_orm.payment_repository.create_payos_payment_link",
        return_value=PAYOS_LINK,
    )
    def test_create_payos_payment_link_for_owned_order(self, create_link):
        user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="payos", payment_status="pending")
        payment = create_payment(order, status="pending")
        create_link.return_value = {**PAYOS_LINK, "order_code": order.order_id, "amount": int(order.final_amount)}

        response = self.client.post(
            "/api/payments/create",
            {"order_id": order.order_id, "method": "payos"},
            format="json",
            **auth_headers(user),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["checkout_url"], PAYOS_LINK["checkout_url"])
        payment.refresh_from_db()
        self.assertEqual(payment.payment_method, "payos")
        self.assertEqual(payment.transaction_id, PAYOS_LINK["payment_link_id"])

    @patch(
        "products.infrastructure.django_orm.payment_repository.get_payos_payment_status",
        return_value=PAYOS_STATUS_PENDING,
    )
    def test_payment_status_only_returns_owned_order(self, get_status):
        user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="payos", payment_status="pending")
        payment = create_payment(order, status="pending")
        get_status.return_value = {
            **PAYOS_STATUS_PENDING,
            "order_code": order.order_id,
            "amount": int(payment.amount),
            "amount_remaining": int(payment.amount),
        }

        response = self.client.get(
            f"/api/payments/{order.order_id}/status",
            **auth_headers(user),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["payment_status"], "pending")
        self.assertEqual(response.data["provider_status"], "PENDING")

    @patch(
        "products.infrastructure.django_orm.payment_repository.get_payos_payment_status",
        return_value=PAYOS_STATUS_PENDING,
    )
    def test_payment_status_reconciles_paid_payos_order_without_webhook(self, get_status):
        user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="payos", payment_status="pending")
        payment = create_payment(order, status="pending")
        get_status.return_value = {
            **PAYOS_STATUS_PENDING,
            "order_code": order.order_id,
            "amount": int(payment.amount),
            "amount_paid": int(payment.amount),
            "amount_remaining": 0,
            "status": "PAID",
            "transaction_id": "TX-RECONCILED",
        }

        response = self.client.get(
            f"/api/payments/{order.order_id}/status",
            **auth_headers(user),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["payment_status"], "paid")
        self.assertEqual(response.data["provider_status"], "PAID")
        payment.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(payment.status, "success")
        self.assertEqual(payment.transaction_id, "TX-RECONCILED")
        self.assertEqual(order.payment_status, "paid")

    @patch(
        "products.infrastructure.django_orm.payment_repository.get_payos_payment_status",
        return_value=PAYOS_STATUS_PENDING,
    )
    def test_payment_status_rejects_paid_amount_mismatch(self, get_status):
        user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="payos", payment_status="pending")
        payment = create_payment(order, status="pending")
        get_status.return_value = {
            **PAYOS_STATUS_PENDING,
            "order_code": order.order_id,
            "amount": int(payment.amount),
            "amount_paid": int(payment.amount) - 1000,
            "amount_remaining": 1000,
            "status": "PAID",
            "transaction_id": "TX-UNDERPAID",
        }

        response = self.client.get(
            f"/api/payments/{order.order_id}/status",
            **auth_headers(user),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payment.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(payment.status, "pending")
        self.assertEqual(order.payment_status, "pending")

    @patch("products.infrastructure.django_orm.payment_repository.cancel_payos_payment_link")
    @patch("products.infrastructure.django_orm.payment_repository.get_payos_payment_status")
    def test_customer_can_switch_pending_payos_order_to_cod(self, get_status, cancel_link):
        user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="payos", payment_status="pending")
        payment = create_payment(order, status="pending")
        order.payment_expires_at = timezone.now() + timedelta(minutes=10)
        order.save(update_fields=["payment_expires_at"])
        get_status.return_value = {
            **PAYOS_STATUS_PENDING,
            "order_code": order.order_id,
            "amount": int(payment.amount),
            "amount_remaining": int(payment.amount),
        }

        response = self.client.post(
            f"/api/payments/{order.order_id}/switch-to-cod",
            {},
            format="json",
            **auth_headers(user),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        order.refresh_from_db()
        payment.refresh_from_db()
        self.assertEqual(order.payment_method, "cod")
        self.assertEqual(order.payment_status, "unpaid")
        self.assertEqual(payment.payment_method, "cod")
        cancel_link.assert_called_once()

    @patch("products.infrastructure.django_orm.payment_repository.cancel_order_and_restore_stock")
    @patch("products.infrastructure.django_orm.payment_repository.cancel_payos_payment_link")
    @patch("products.infrastructure.django_orm.payment_repository.get_payos_payment_status")
    def test_expired_payos_order_is_cancelled(self, get_status, cancel_link, cancel_order):
        user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="payos", payment_status="pending")
        payment = create_payment(order, status="pending")
        order.payment_expires_at = timezone.now() - timedelta(seconds=1)
        order.save(update_fields=["payment_expires_at"])
        get_status.return_value = {
            **PAYOS_STATUS_PENDING,
            "order_code": order.order_id,
            "amount": int(payment.amount),
            "amount_remaining": int(payment.amount),
        }

        def cancel_side_effect(order_id, *_args):
            Order.objects.filter(order_id=order_id).update(status="cancelled", payment_status="unpaid")

        cancel_order.side_effect = cancel_side_effect
        response = self.client.get(
            f"/api/payments/{order.order_id}/status",
            **auth_headers(user),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["order_status"], "cancelled")
        self.assertEqual(response.data["payment_status"], "failed")
        cancel_link.assert_called_once()

    @patch("products.infrastructure.django_orm.order_repository.send_order_confirmation", return_value={"skipped": True})
    @patch("products.infrastructure.django_orm.order_repository.decrease_variant_stock", return_value=True)
    @patch("products.infrastructure.django_orm.order_repository.check_variant_stock", return_value={"available_stock": 10})
    def test_cancelled_order_can_be_reordered_as_cod(self, _stock, _decrease, _email):
        user, customer = create_customer_user()
        old_order = create_order(customer=customer, payment_method="payos", payment_status="failed", status="cancelled")
        product = create_product(stock=10)
        create_order_item(old_order, product=product, variant=product.variants.first(), quantity=1)

        response = self.client.post(
            f"/api/payments/{old_order.order_id}/reorder-cod",
            {},
            format="json",
            **auth_headers(user),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["payment_method"], "cod")
        self.assertEqual(response.data["payment_status"], "unpaid")

    @patch("products.interfaces.api.payment_views.verify_payos_webhook")
    def test_valid_payos_webhook_updates_payment_order_and_log(self, verify_webhook):
        _user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="payos", payment_status="pending")
        payment = create_payment(order, status="pending")
        verify_webhook.return_value = {
            "order_id": order.order_id,
            "success": True,
            "transaction_id": "TX123",
            "payment_link_id": "payos-link-123",
            "amount": int(payment.amount),
        }

        response = self.client.post(
            "/api/payments/payos/webhook",
            {"code": "00", "data": {"orderCode": order.order_id}, "signature": "signed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payment.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(payment.status, "success")
        self.assertEqual(order.payment_status, "paid")
        self.assertTrue(PaymentWebhookLog.objects.filter(payment=payment, processed=True).exists())
        self.assertTrue(Notification.objects.filter(
            user=customer.user,
            notification_type="payment",
            title="Thanh toán thành công",
        ).exists())

    @patch("products.interfaces.api.payment_views.verify_payos_webhook")
    def test_invalid_payos_signature_is_rejected(self, verify_webhook):
        _user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="payos", payment_status="pending")
        payment = create_payment(order, status="pending")
        verify_webhook.side_effect = InvalidPayOSWebhook("Data not integrity")

        response = self.client.post(
            "/api/payments/payos/webhook",
            {"code": "00", "data": {"orderCode": order.order_id}, "signature": "forged"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payment.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(payment.status, "pending")
        self.assertEqual(order.payment_status, "pending")

    @patch("products.interfaces.api.payment_views.verify_payos_webhook")
    def test_payos_webhook_rejects_amount_mismatch(self, verify_webhook):
        _user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="payos", payment_status="pending")
        payment = create_payment(order, status="pending")
        verify_webhook.return_value = {
            "order_id": order.order_id,
            "success": True,
            "transaction_id": "TX123",
            "payment_link_id": "payos-link-123",
            "amount": int(payment.amount) - 1000,
        }

        response = self.client.post(
            "/api/payments/payos/webhook",
            {"code": "00", "data": {"orderCode": order.order_id}, "signature": "signed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payment.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(payment.status, "pending")
        self.assertEqual(order.payment_status, "pending")
        self.assertTrue(
            PaymentWebhookLog.objects.filter(payment=payment, process_message="Payment amount mismatch").exists()
        )

    @patch("products.interfaces.api.payment_views.verify_payos_webhook")
    def test_repeated_payos_webhook_is_idempotent(self, verify_webhook):
        _user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="payos", payment_status="pending")
        payment = create_payment(order, status="pending")
        verify_webhook.return_value = {
            "order_id": order.order_id,
            "success": True,
            "transaction_id": "TX123",
            "payment_link_id": "payos-link-123",
            "amount": int(payment.amount),
        }
        payload = {"code": "00", "data": {"orderCode": order.order_id}, "signature": "signed"}

        first = self.client.post(
            "/api/payments/payos/webhook",
            data=json.dumps(payload),
            content_type="application/json",
        )
        second = self.client.post(
            "/api/payments/payos/webhook",
            data=json.dumps(payload),
            content_type="application/json",
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(PaymentWebhookLog.objects.filter(payment__order=order).count(), 2)
        self.assertEqual(Notification.objects.filter(
            user=customer.user,
            notification_type="payment",
        ).count(), 1)
