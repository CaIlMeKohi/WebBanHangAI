from rest_framework import status
from rest_framework.test import APITestCase

from products.models import Payment, ReturnRequest
from products.tests.factories import (
    auth_headers,
    create_customer_user,
    create_order,
    create_order_item,
    create_product,
    create_staff_user,
)


class ReturnWorkflowTests(APITestCase):
    def setUp(self):
        self.staff_user, _staff = create_staff_user()
        _customer_user, self.customer = create_customer_user()
        self.product = create_product(stock=10)
        self.variant = self.product.variants.first()
        self.order = create_order(
            customer=self.customer,
            status="completed",
            payment_method="bank_transfer",
            payment_status="paid",
        )
        self.order_item = create_order_item(
            self.order,
            product=self.product,
            variant=self.variant,
        )
        self.payment = Payment.objects.create(
            order=self.order,
            amount=self.order.final_amount,
            payment_method="bank_transfer",
            status="success",
        )
        self.return_request = ReturnRequest.objects.create(
            user=self.customer,
            order=self.order,
            order_item=self.order_item,
            reason="Damaged",
            desired_solution="refund",
            status="approved",
        )

    def test_complete_return_restores_stock_once_and_marks_refund_pending(self):
        first = self.client.put(
            f"/api/staff/returns/{self.return_request.return_id}/status",
            {"status": "completed", "reason": "Received returned item"},
            format="json",
            **auth_headers(self.staff_user),
        )
        second = self.client.put(
            f"/api/staff/returns/{self.return_request.return_id}/status",
            {"status": "completed", "reason": "Repeated request"},
            format="json",
            **auth_headers(self.staff_user),
        )

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_400_BAD_REQUEST)
        self.variant.refresh_from_db()
        self.order.refresh_from_db()
        self.payment.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 11)
        self.assertEqual(self.order.payment_status, "refund_pending")
        self.assertEqual(self.payment.status, "refund_pending")
