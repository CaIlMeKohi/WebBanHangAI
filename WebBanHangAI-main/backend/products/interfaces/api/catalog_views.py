from __future__ import annotations

import json

from django.db import DatabaseError
from django.http import Http404
from rest_framework import generics, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework import viewsets

from products.application.catalog.dto import ProductListQueryDTO
from products.application.catalog.use_cases import (
    DeleteCategoryUseCase,
    GetProductDetailUseCase,
    ListAdminBrandsUseCase,
    ListAdminCategoriesUseCase,
    ListBrandsUseCase,
    ListCategoriesUseCase,
    ListProductsUseCase,
)
from products.application.customer_context import get_active_user, get_customer_for_user
from products.infrastructure.django_orm.catalog_repository import DjangoOrmCatalogRepository
from products.models import SearchLog, UserInteraction
from products.security.permissions import IsAdmin
from products.serializers import BrandSerializer, CategorySerializer, ProductSerializer


class ProductPagination(PageNumberPagination):
    page_size = 32
    page_size_query_param = 'page_size'
    max_page_size = 100


def _catalog_repository() -> DjangoOrmCatalogRepository:
    return DjangoOrmCatalogRepository()


def _get_user(request):
    if getattr(getattr(request, 'user', None), 'user_id', None):
        return request.user
    user_id = request.query_params.get('user_id') or getattr(request, 'data', {}).get('user_id')
    if not user_id:
        return None
    return get_active_user(user_id)


def _get_customer(user):
    return get_customer_for_user(user)


class ProductListAPIView(generics.ListAPIView):
    serializer_class = ProductSerializer
    pagination_class = ProductPagination

    def get_queryset(self):
        filters = ProductListQueryDTO.from_query_params(self.request.query_params)
        queryset = ListProductsUseCase(_catalog_repository()).execute(filters)
        self._record_search_if_needed(filters, queryset)
        return queryset

    def _record_search_if_needed(self, filters: ProductListQueryDTO, queryset) -> None:
        if not filters.search:
            return
        user = _get_user(self.request)
        customer = _get_customer(user)
        try:
            SearchLog.objects.create(
                user=customer,
                session_id=filters.session_id,
                query=filters.search[:255],
                filters=json.dumps(dict(self.request.query_params), ensure_ascii=False),
                result_count=queryset.count(),
            )
        except DatabaseError:
            pass
        first_product = queryset.first()
        if user and customer and first_product:
            try:
                UserInteraction.objects.create(
                    user=customer,
                    product=first_product,
                    interaction_type='search',
                    search_query=filters.search[:255],
                    score=0.5,
                )
            except DatabaseError:
                pass


class ProductDetailAPIView(generics.RetrieveAPIView):
    serializer_class = ProductSerializer
    lookup_field = 'product_id'
    lookup_url_kwarg = 'id'

    def get_object(self):
        product_id = self.kwargs.get(self.lookup_url_kwarg)
        try:
            return GetProductDetailUseCase(_catalog_repository()).execute(product_id)
        except Exception as exc:
            if exc.__class__.__name__ == 'DoesNotExist':
                raise Http404 from exc
            raise

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        user = _get_user(request)
        customer = _get_customer(user)
        if user and customer:
            try:
                UserInteraction.objects.create(
                    user=customer,
                    product=self.get_object(),
                    interaction_type='view',
                    score=1.0,
                )
            except DatabaseError:
                pass
        return response


class CategoryListAPIView(generics.ListAPIView):
    serializer_class = CategorySerializer

    def get_queryset(self):
        return ListCategoriesUseCase(_catalog_repository()).execute()


class BrandListAPIView(generics.ListAPIView):
    serializer_class = BrandSerializer

    def get_queryset(self):
        return ListBrandsUseCase(_catalog_repository()).execute()


class AdminCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return ListAdminCategoriesUseCase(_catalog_repository()).execute()

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        category, action = DeleteCategoryUseCase(_catalog_repository()).execute(category)
        if action == 'deactivated':
            return Response(status=status.HTTP_204_NO_CONTENT)
        return super().destroy(request, *args, **kwargs)


class AdminBrandViewSet(viewsets.ModelViewSet):
    serializer_class = BrandSerializer
    permission_classes = [IsAdmin]

    def get_queryset(self):
        return ListAdminBrandsUseCase(_catalog_repository()).execute()
