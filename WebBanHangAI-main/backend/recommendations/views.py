from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from products.serializers import ProductSerializer
from products.models import Customer, PrecomputedRecommendation, RecommendationLog

from .services import get_for_you_recommendations, get_related_products


class ForYouRecommendationsAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        user_id = request.query_params.get('user_id')
        session_id = request.query_params.get('session_id')
        search = request.query_params.get('search')
        try:
            limit = int(request.query_params.get('limit', 8))
        except (TypeError, ValueError):
            limit = 8
        limit = max(1, min(limit, 24))

        products = get_for_you_recommendations(user_id=user_id, session_id=session_id, limit=limit, search=search)
        customer = Customer.objects.filter(user_id=user_id, user__account_status='active').first() if user_id else None
        precomputed = {
            item.product_id: item
            for item in PrecomputedRecommendation.objects.filter(user=customer, product_id__in=[product.product_id for product in products])
        } if customer else {}
        RecommendationLog.objects.bulk_create([
            RecommendationLog(
                user=customer,
                session_id=session_id,
                recommendation=precomputed.get(product.product_id),
                product=product,
            )
            for product in products
        ])
        serializer = ProductSerializer(products, many=True, context={'request': request})
        return Response({'results': serializer.data, 'count': len(serializer.data)}, status=status.HTTP_200_OK)


class RelatedProductsAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, product_id):
        try:
            limit = int(request.query_params.get('limit', 4))
        except (TypeError, ValueError):
            limit = 4
        limit = max(1, min(limit, 24))
        products = get_related_products(str(product_id), limit=limit)
        serializer = ProductSerializer(products, many=True, context={'request': request})
        return Response({'results': serializer.data, 'count': len(serializer.data)}, status=status.HTTP_200_OK)
