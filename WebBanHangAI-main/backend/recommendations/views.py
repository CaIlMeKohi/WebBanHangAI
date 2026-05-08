from rest_framework.response import Response
from rest_framework.views import APIView

from products.serializers import ProductSerializer

from .services import get_for_you_recommendations, get_related_products


def _parse_limit(raw: str | None, default: int) -> int:
    try:
        value = int(raw) if raw is not None else default
    except ValueError:
        return default
    return max(1, min(value, 50))


class ForYouRecommendationAPIView(APIView):
    def get(self, request):
        user_id = request.query_params.get('user_id')
        session_id = request.query_params.get('session_id')
        limit = _parse_limit(request.query_params.get('limit'), 8)

        queryset = get_for_you_recommendations(user_id=user_id, session_id=session_id, limit=limit)
        serializer = ProductSerializer(queryset, many=True)
        return Response(serializer.data)


class RelatedProductsAPIView(APIView):
    def get(self, request, product_id: str):
        limit = _parse_limit(request.query_params.get('limit'), 4)
        queryset = get_related_products(product_id=product_id, limit=limit)
        serializer = ProductSerializer(queryset, many=True)
        return Response(serializer.data)
