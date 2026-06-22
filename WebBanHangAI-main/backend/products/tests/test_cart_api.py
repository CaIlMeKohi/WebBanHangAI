from rest_framework import status
from rest_framework.test import APITestCase

from products.models import CartItem
from products.tests.factories import auth_headers, create_cart_item, create_customer_user, create_product


class CartApiTests(APITestCase):
    def setUp(self):
        self.user, self.customer = create_customer_user()
        self.product = create_product(stock=5)
        self.variant = self.product.variants.first()

    def test_get_cart(self):
        create_cart_item(self.customer, self.variant, quantity=2)

        response = self.client.get(f"/api/products/cart/?user_id={self.user.user_id}", **auth_headers(self.user))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["quantity"], 2)
        self.assertIn("product", response.data[0])

    def test_add_item(self):
        response = self.client.post(
            "/api/products/cart/",
            {"user_id": self.user.user_id, "product_id": self.product.product_id, "quantity": 2},
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["quantity"], 2)
        self.assertEqual(response.data["product_id"], self.product.product_id)

    def test_update_quantity(self):
        item = create_cart_item(self.customer, self.variant, quantity=1)

        response = self.client.put(
            f"/api/products/cart/{item.cart_item_id}/",
            {"user_id": self.user.user_id, "quantity": 3},
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["quantity"], 3)

    def test_delete_item(self):
        item = create_cart_item(self.customer, self.variant, quantity=1)

        response = self.client.delete(
            f"/api/products/cart/{item.cart_item_id}/?user_id={self.user.user_id}",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(CartItem.objects.filter(cart_item_id=item.cart_item_id).exists())

    def test_add_item_over_stock_returns_error_not_500(self):
        response = self.client.post(
            "/api/products/cart/",
            {"user_id": self.user.user_id, "product_id": self.product.product_id, "quantity": 99},
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)
