from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from products.serializers import ProductSerializer

from .services import get_for_you_recommendations


class ForYouRecommendationsAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        user_id = request.query_params.get('user_id')
        session_id = request.query_params.get('session_id')
        try:
            limit = int(request.query_params.get('limit', 8))
        except (TypeError, ValueError):
            limit = 8
        limit = max(1, min(limit, 24))

        products = get_for_you_recommendations(user_id=user_id, session_id=session_id, limit=limit)
        serializer = ProductSerializer(products, many=True, context={'request': request})
        return Response({'results': serializer.data, 'count': len(serializer.data)}, status=status.HTTP_200_OK)
