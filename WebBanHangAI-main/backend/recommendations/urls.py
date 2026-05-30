from django.urls import path

from .views import ForYouRecommendationsAPIView

urlpatterns = [
	path('for-you/', ForYouRecommendationsAPIView.as_view()),
]