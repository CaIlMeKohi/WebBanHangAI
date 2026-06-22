from rest_framework import status
from rest_framework.test import APITestCase

from products.models import WishlistItem
from products.tests.factories import auth_headers, create_customer_user, create_product


class WishlistApiTests(APITestCase):
    def setUp(self):
        self.user, self.customer = create_customer_user()
        self.product = create_product()

    def test_delete_wishlist_item_persists_in_database(self):
        WishlistItem.objects.create(user=self.customer, product=self.product)

        response = self.client.delete(
            f"/api/products/wishlist/{self.product.product_id}/",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(
            WishlistItem.objects.filter(user=self.customer, product=self.product).exists(),
        )

    def test_delete_missing_wishlist_item_returns_404(self):
        response = self.client.delete(
            f"/api/products/wishlist/{self.product.product_id}/",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
