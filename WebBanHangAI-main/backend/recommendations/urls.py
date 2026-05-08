from django.urls import path

from .views import ForYouRecommendationAPIView, RelatedProductsAPIView

urlpatterns = [
    path('for-you/', ForYouRecommendationAPIView.as_view(), name='for-you-recommendations'),
    path('related/<str:product_id>/', RelatedProductsAPIView.as_view(), name='related-products'),
]
