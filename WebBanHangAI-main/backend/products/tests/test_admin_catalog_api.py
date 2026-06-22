from rest_framework import status
from rest_framework.test import APITestCase

from products.models import Brand, Category, Product
from products.tests.factories import auth_headers, create_admin_user, create_brand, create_category, create_customer_user, create_product


class AdminCatalogApiTests(APITestCase):
    def setUp(self):
        self.admin_user, _admin = create_admin_user()
        self.customer_user, _customer = create_customer_user()
        self.category = create_category(name="Admin Category", slug="admin-category")
        self.brand = create_brand(name="Admin Brand", slug="admin-brand")

    def test_admin_create_update_delete_product(self):
        create_response = self.client.post(
            "/api/products/admin/products/",
            {
                "name": "Admin Product",
                "slug": "admin-product",
                "description": "Admin product description",
                "base_price": "150000",
                "category_id": self.category.category_id,
                "brand_id": self.brand.brand_id,
                "gender": "unisex",
                "status": "active",
            },
            format="json",
            **auth_headers(self.admin_user),
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        product_id = create_response.data["product_id"]

        update_response = self.client.put(
            f"/api/products/admin/products/{product_id}/",
            {
                "name": "Admin Product Updated",
                "slug": "admin-product-updated",
                "description": "Updated",
                "base_price": "160000",
                "category_id": self.category.category_id,
                "brand_id": self.brand.brand_id,
                "gender": "men",
                "status": "active",
            },
            format="json",
            **auth_headers(self.admin_user),
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["name"], "Admin Product Updated")

        delete_response = self.client.delete(
            f"/api/products/admin/products/{product_id}/",
            **auth_headers(self.admin_user),
        )
        self.assertIn(delete_response.status_code, [status.HTTP_204_NO_CONTENT, status.HTTP_409_CONFLICT])

    def test_customer_cannot_create_admin_product(self):
        response = self.client.post(
            "/api/products/admin/products/",
            {
                "name": "Blocked Product",
                "slug": "blocked-product",
                "base_price": "100000",
                "category_id": self.category.category_id,
                "brand_id": self.brand.brand_id,
            },
            format="json",
            **auth_headers(self.customer_user),
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_create_update_delete_category(self):
        create_response = self.client.post(
            "/api/products/admin/categories/",
            {"name": "New Category", "slug": "new-category"},
            format="json",
            **auth_headers(self.admin_user),
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        category_id = create_response.data["id"]

        update_response = self.client.put(
            f"/api/products/admin/categories/{category_id}/",
            {"name": "Updated Category", "slug": "updated-category"},
            format="json",
            **auth_headers(self.admin_user),
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["name"], "Updated Category")

        delete_response = self.client.delete(
            f"/api/products/admin/categories/{category_id}/",
            **auth_headers(self.admin_user),
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)

    def test_category_with_product_delete_keeps_rule(self):
        product = create_product(category=self.category, brand=self.brand)

        response = self.client.delete(
            f"/api/products/admin/categories/{self.category.category_id}/",
            **auth_headers(self.admin_user),
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.category.refresh_from_db()
        self.assertFalse(self.category.is_active)
        self.assertTrue(Product.objects.filter(product_id=product.product_id).exists())

    def test_admin_create_update_delete_brand(self):
        create_response = self.client.post(
            "/api/products/admin/brands/",
            {"name": "New Brand", "slug": "new-brand"},
            format="json",
            **auth_headers(self.admin_user),
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        brand_id = create_response.data["brand_id"]

        update_response = self.client.put(
            f"/api/products/admin/brands/{brand_id}/",
            {"name": "Updated Brand", "slug": "updated-brand"},
            format="json",
            **auth_headers(self.admin_user),
        )
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["name"], "Updated Brand")

        delete_response = self.client.delete(
            f"/api/products/admin/brands/{brand_id}/",
            **auth_headers(self.admin_user),
        )
        self.assertEqual(delete_response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Brand.objects.filter(brand_id=brand_id).exists())
