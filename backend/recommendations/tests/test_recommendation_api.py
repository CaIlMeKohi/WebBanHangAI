from rest_framework import status
from rest_framework.test import APITestCase

from products.models import RecommendationLog, UserInteraction
from products.tests.factories import auth_headers, create_customer_user, create_product


def results(data):
    return data["results"] if isinstance(data, dict) and "results" in data else data


class RecommendationApiTests(APITestCase):
    def setUp(self):
        self.user, self.customer = create_customer_user()
        self.product = create_product(name="Recommended Shirt", gender="men", stock=10)
        self.related = create_product(name="Related Shirt", category=self.product.category, brand=self.product.brand, gender="men", stock=10)

    def test_for_you_returns_product_shape_without_precomputed_data(self):
        response = self.client.get("/api/recommendations/for-you/", {"user_id": str(self.user.user_id), "limit": 5})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = results(response.data)
        self.assertTrue(items)
        for field in ["id", "name", "price", "category", "gender"]:
            self.assertIn(field, items[0])

    def test_related_returns_product_shape(self):
        response = self.client.get(f"/api/recommendations/related/{self.product.product_id}/", {"limit": 4})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        items = results(response.data)
        self.assertTrue(items)
        self.assertTrue(all(str(item["id"]) != str(self.product.product_id) for item in items))

    def test_product_event_records_user_interaction(self):
        response = self.client.post(
            "/api/products/events/",
            {
                "user_id": self.customer.customer_id,
                "product_id": self.product.product_id,
                "interaction_type": "view",
                "session_id": "test-session",
                "score": "1.0",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(UserInteraction.objects.filter(product=self.product, interaction_type="view").exists())

    def test_recommendation_click_records_log(self):
        response = self.client.post(
            f"/api/recommendations/{self.product.product_id}/click",
            {},
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(RecommendationLog.objects.filter(product=self.product, clicked=True).exists())

    def test_recommendation_impression_records_log(self):
        response = self.client.post(
            f"/api/recommendations/{self.product.product_id}/impression",
            {},
            format="json",
            **auth_headers(self.user),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(RecommendationLog.objects.filter(product=self.product, clicked=False).exists())
