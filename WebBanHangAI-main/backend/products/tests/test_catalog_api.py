from rest_framework import status
from rest_framework.test import APITestCase

from products.tests.factories import create_brand, create_category, create_product


def results(data):
    return data["results"] if isinstance(data, dict) and "results" in data else data


class CatalogApiTests(APITestCase):
    def setUp(self):
        self.shirts = create_category(name="Ao so mi", slug="ao-so-mi")
        self.shoes = create_category(name="Giay", slug="giay")
        self.brand = create_brand(name="Local Brand", slug="local-brand")
        self.men_product = create_product(name="Men Shirt", category=self.shirts, brand=self.brand, gender="men", price=200000)
        self.women_product = create_product(name="Women Shoes", category=self.shoes, brand=self.brand, gender="women", price=300000)

    def test_product_list_returns_frontend_contract_fields(self):
        response = self.client.get("/api/products/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        item = results(response.data)[0]
        for field in ["id", "slug", "name", "price", "image", "category", "gender", "colors", "sizes", "stockQuantity"]:
            self.assertIn(field, item)

    def test_product_detail_returns_product_contract(self):
        response = self.client.get(f"/api/products/{self.men_product.product_id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], str(self.men_product.product_id))
        self.assertEqual(response.data["brandName"], self.brand.name)
        self.assertEqual(response.data["category"], self.shirts.slug)
        self.assertIn("images", response.data)

    def test_filter_by_category_does_not_return_wrong_category(self):
        response = self.client.get("/api/products/", {"category": self.shirts.slug})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(results(response.data))
        self.assertTrue(all(item["category"] == self.shirts.slug for item in results(response.data)))

    def test_filter_by_gender_men(self):
        response = self.client.get("/api/products/", {"gender": "men"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(results(response.data))
        self.assertTrue(all(item["gender"] in {"men", "unisex"} for item in results(response.data)))

    def test_filter_by_gender_women(self):
        response = self.client.get("/api/products/", {"gender": "women"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(results(response.data))
        self.assertTrue(all(item["gender"] in {"women", "unisex"} for item in results(response.data)))

    def test_search_keyword(self):
        response = self.client.get("/api/products/", {"search": "Women Shoes"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        names = [item["name"] for item in results(response.data)]
        self.assertIn("Women Shoes", names)

    def test_sort_supported_query_still_returns_200(self):
        response = self.client.get("/api/products/", {"sort": "price_asc"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(results(response.data)), 2)
