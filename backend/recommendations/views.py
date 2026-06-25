from products.interfaces.api.recommendation_views import (
    ForYouRecommendationsAPIView as CleanForYouRecommendationsAPIView,
    RelatedProductsAPIView as CleanRelatedProductsAPIView,
)


class ForYouRecommendationsAPIView(CleanForYouRecommendationsAPIView):
    """Compatibility wrapper for the existing /api/recommendations/for-you/ route."""


class RelatedProductsAPIView(CleanRelatedProductsAPIView):
    """Compatibility wrapper for the existing /api/recommendations/related/<id>/ route."""
