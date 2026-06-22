from django.urls import path

from .views import ForYouRecommendationsAPIView, RelatedProductsAPIView

urlpatterns = [
	path('for-you/', ForYouRecommendationsAPIView.as_view()),
	path('related/<int:product_id>/', RelatedProductsAPIView.as_view()),
]
