from rest_framework import status
from rest_framework.test import APITestCase
from django.test import override_settings

from products.models import PaymentWebhookLog
from products.tests.factories import create_customer_user, create_order, create_payment


@override_settings(PAYMENT_WEBHOOK_SECRET="test-payment-secret")
class PaymentCallbackApiTests(APITestCase):
    webhook_headers = {"HTTP_X_PAYMENT_WEBHOOK_SECRET": "test-payment-secret"}

    def test_payment_callback_success_updates_payment_order_and_webhook_log(self):
        _user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="bank_transfer", payment_status="pending")
        payment = create_payment(order, status="pending")

        response = self.client.post(
            "/api/payments/bank_transfer/callback",
            {"order_id": order.order_id, "success": True, "transaction_id": "TX123"},
            format="json",
            **self.webhook_headers,
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payment.refresh_from_db()
        order.refresh_from_db()
        self.assertEqual(payment.status, "success")
        self.assertEqual(order.payment_status, "paid")
        self.assertTrue(PaymentWebhookLog.objects.filter(payment=payment, processed=True).exists())

    def test_payment_callback_repeated_does_not_crash(self):
        _user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="bank_transfer", payment_status="pending")
        create_payment(order, status="pending")

        first = self.client.post(
            "/api/payments/bank_transfer/callback",
            {"order_id": order.order_id, "success": True, "transaction_id": "TX123"},
            format="json",
            **self.webhook_headers,
        )
        second = self.client.post(
            "/api/payments/bank_transfer/callback",
            {"order_id": order.order_id, "success": True, "transaction_id": "TX123"},
            format="json",
            **self.webhook_headers,
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(PaymentWebhookLog.objects.filter(payment__order=order).count(), 2)

    def test_payment_callback_rejects_amount_mismatch(self):
        _user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="bank_transfer", payment_status="pending")
        payment = create_payment(order, status="pending")

        response = self.client.post(
            "/api/payments/bank_transfer/callback",
            {
                "order_id": order.order_id,
                "success": True,
                "transaction_id": "TX-AMOUNT-MISMATCH",
                "amount": "1",
            },
            format="json",
            **self.webhook_headers,
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        payment.refresh_from_db()
        self.assertEqual(payment.status, "pending")
