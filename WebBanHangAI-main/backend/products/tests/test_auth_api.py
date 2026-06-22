from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from products.tests.factories import DEFAULT_PASSWORD, auth_headers, create_customer_user


class AuthApiTests(APITestCase):
    @patch("products.infrastructure.django_orm.user_repository.send_registration_otp", return_value={"ok": True, "sent": True})
    def test_register_customer_requires_otp(self, _send_email):
        response = self.client.post(
            "/api/products/auth/register/",
            {
                "username": "newcustomer@example.com",
                "full_name": "New Customer",
                "phone": "0987654321",
                "password": DEFAULT_PASSWORD,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["requires_otp"])
        self.assertEqual(response.data["email"], "newcustomer@example.com")

    @patch("products.infrastructure.django_orm.user_repository.send_registration_otp", return_value={"ok": True, "sent": True})
    def test_register_duplicate_email_returns_error_not_500(self, _send_email):
        create_customer_user(email="dup@example.com")

        response = self.client.post(
            "/api/products/auth/register/",
            {
                "username": "dup@example.com",
                "full_name": "Duplicate Customer",
                "phone": "0987654322",
                "password": DEFAULT_PASSWORD,
            },
            format="json",
        )

        self.assertIn(response.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_409_CONFLICT])
        self.assertIn("detail", response.data)

    def test_login_customer_success(self):
        user, _customer = create_customer_user(email="login@example.com", password=DEFAULT_PASSWORD)

        response = self.client.post(
            "/api/products/auth/login/",
            {"username": user.email, "password": DEFAULT_PASSWORD},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertEqual(response.data["user"]["role"], "customer")

    def test_login_wrong_password_returns_error(self):
        user, _customer = create_customer_user(email="wrong@example.com", password=DEFAULT_PASSWORD)

        response = self.client.post(
            "/api/products/auth/login/",
            {"username": user.email, "password": "WrongPass1!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

    def test_me_endpoint_uses_store_user_authentication(self):
        user, _customer = create_customer_user()

        response = self.client.get("/api/auth/me", **auth_headers(user))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user_id"], user.user_id)
        self.assertEqual(response.data["role"], "customer")

    def test_profile_endpoint_returns_current_shape(self):
        user, _customer = create_customer_user()

        response = self.client.get(f"/api/products/profile/?user_id={user.user_id}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        for field in ["user_id", "username", "full_name", "email", "phone", "role"]:
            self.assertIn(field, response.data)
