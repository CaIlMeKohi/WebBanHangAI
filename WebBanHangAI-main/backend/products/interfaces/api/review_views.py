from __future__ import annotations

from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from products.application.reviews.dto import CreateReviewDTO, ModerateReviewDTO
from products.application.reviews.use_cases import (
    CreateReviewUseCase,
    DeleteReviewUseCase,
    ListProductReviewsUseCase,
    ListStaffReviewsUseCase,
    ModerateReviewUseCase,
)
from products.domain.common.exceptions import BusinessRuleViolation, NotFoundError
from products.infrastructure.django_orm.review_repository import DjangoOrmReviewRepository
from products.security.permissions import IsAdmin, IsCustomer


def _review_repository() -> DjangoOrmReviewRepository:
    return DjangoOrmReviewRepository()


class ReviewCreateAPIView(APIView):
    permission_classes = [IsCustomer]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def post(self, request):
        customer = request.user.customer_profile
        payload = request.data.copy()
        images = request.FILES.getlist('images')
        if hasattr(payload, 'setlist'):
            payload.setlist('images', images)
        else:
            payload['images'] = images
        try:
            review_id = CreateReviewUseCase(_review_repository()).execute(
                customer,
                CreateReviewDTO.from_payload(payload),
            )
        except (TypeError, ValueError):
            return Response({'detail': 'Rating phai tu 1 den 5'}, status=status.HTTP_400_BAD_REQUEST)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'review_id': review_id}, status=status.HTTP_201_CREATED)


class ProductReviewsAPIView(APIView):
    def get(self, request, product_id):
        return Response(ListProductReviewsUseCase(_review_repository()).execute(product_id))


class StaffReviewListAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(ListStaffReviewsUseCase(_review_repository()).execute(request.query_params.get('status')))


class StaffReviewModerateAPIView(APIView):
    permission_classes = [IsAdmin]

    def put(self, request, review_id):
        try:
            ModerateReviewUseCase(_review_repository()).execute(
                request.user.staff_profile,
                review_id,
                ModerateReviewDTO.from_payload(request.data),
            )
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Da ghi nhan ket qua duyet danh gia'})


class AdminReviewDeleteAPIView(APIView):
    permission_classes = [IsAdmin]

    def delete(self, request, review_id):
        try:
            DeleteReviewUseCase(_review_repository()).execute(request.user, review_id)
        except NotFoundError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_404_NOT_FOUND)
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)
