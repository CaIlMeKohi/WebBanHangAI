from __future__ import annotations

from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.recommendations.dto import (
    ForYouQueryDTO,
    RecommendationMetricsDTO,
    RelatedProductsQueryDTO,
    RunRecommendationDTO,
)
from products.application.recommendations.use_cases import (
    GetForYouRecommendationsUseCase,
    GetRecommendationMetricsUseCase,
    GetRelatedProductsUseCase,
    RecordRecommendationEventUseCase,
    RunRecommendationBatchUseCase,
)
from products.domain.common.exceptions import NotFoundError
from products.infrastructure.django_orm.recommendation_repository import DjangoOrmRecommendationRepository
from products.security.permissions import IsAdmin, IsStoreAuthenticated
from products.serializers import ProductSerializer


def _recommendation_repository() -> DjangoOrmRecommendationRepository:
    return DjangoOrmRecommendationRepository()


class ForYouRecommendationsAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        query = ForYouQueryDTO.from_query_params(request.query_params)
        authenticated_user_id = getattr(getattr(request, 'user', None), 'user_id', None)
        query = ForYouQueryDTO(
            user_id=str(authenticated_user_id) if authenticated_user_id else None,
            session_id=query.session_id if not authenticated_user_id else None,
            search=query.search,
            limit=query.limit,
        )
        products = GetForYouRecommendationsUseCase(_recommendation_repository()).execute(
            query,
        )
        serializer = ProductSerializer(products, many=True, context={'request': request})
        return Response({'results': serializer.data, 'count': len(serializer.data)}, status=status.HTTP_200_OK)


class RelatedProductsAPIView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, product_id):
        products = GetRelatedProductsUseCase(_recommendation_repository()).execute(
            RelatedProductsQueryDTO.from_query_params(product_id, request.query_params),
        )
        serializer = ProductSerializer(products, many=True, context={'request': request})
        return Response({'results': serializer.data, 'count': len(serializer.data)}, status=status.HTTP_200_OK)


class RunRecommendationAPIView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        result = RunRecommendationBatchUseCase(_recommendation_repository()).execute(
            RunRecommendationDTO.from_payload(request.data),
        )
        return Response({'generated': result['generated']})


class RecommendationMetricsAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(GetRecommendationMetricsUseCase(_recommendation_repository()).execute(
            RecommendationMetricsDTO.from_query_params(request.query_params),
        ))


class RecommendationEventAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def post(self, request, product_id, event_type):
        try:
            RecordRecommendationEventUseCase(_recommendation_repository()).execute(request.user, product_id, event_type)
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        return Response({'detail': 'Da ghi log recommendation'})
