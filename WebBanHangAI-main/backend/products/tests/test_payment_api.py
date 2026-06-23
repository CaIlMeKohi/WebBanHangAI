from rest_framework import status
from rest_framework.test import APITestCase

from products.models import Notification, PaymentWebhookLog
from products.tests.factories import create_customer_user, create_order, create_payment


class PaymentCallbackApiTests(APITestCase):
    def test_payment_callback_success_updates_payment_order_and_webhook_log(self):
        _user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="bank_transfer", payment_status="pending")
        payment = create_payment(order, status="pending")

        response = self.client.post(
            "/api/payments/bank_transfer/callback",
            {"order_id": order.order_id, "success": True, "transaction_id": "TX123"},
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

    def test_payment_callback_repeated_does_not_crash(self):
        _user, customer = create_customer_user()
        order = create_order(customer=customer, payment_method="bank_transfer", payment_status="pending")
        create_payment(order, status="pending")

        first = self.client.post(
            "/api/payments/bank_transfer/callback",
            {"order_id": order.order_id, "success": True, "transaction_id": "TX123"},
            format="json",
        )
        second = self.client.post(
            "/api/payments/bank_transfer/callback",
            {"order_id": order.order_id, "success": True, "transaction_id": "TX123"},
            format="json",
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertEqual(PaymentWebhookLog.objects.filter(payment__order=order).count(), 2)
        self.assertEqual(Notification.objects.filter(
            user=customer.user,
            notification_type="payment",
        ).count(), 1)
