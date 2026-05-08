from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser

from .models import Product, ProductImage, ProductVariant, Category, Brand, UserInteraction
from .serializers import ProductSerializer, UserProductEventSerializer, ProductAdminSerializer


class ProductListAPIView(generics.ListAPIView):
    serializer_class = ProductSerializer

    def get_queryset(self):
        queryset = Product.objects.filter(is_active=True).select_related('category', 'brand').prefetch_related('images', 'variants', 'category__children', 'interactions')

        category = self.request.query_params.get('category')
        is_new = self.request.query_params.get('new')
        is_sale = self.request.query_params.get('sale')
        search = self.request.query_params.get('search')
        subcategories = self.request.query_params.getlist('subcategory')

        if category:
            queryset = queryset.filter(Q(category__slug=category) | Q(category__parent__slug=category))
        if is_new in {'true', '1'}:
            queryset = queryset.filter(created_at__gte=timezone.now() - timedelta(days=30))
        if is_sale in {'true', '1'}:
            queryset = queryset.filter(sale_price__isnull=False)
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(description__icontains=search) | Q(feature_text__icontains=search))
        if subcategories:
            queryset = queryset.filter(category__slug__in=subcategories)

        return queryset


class ProductDetailAPIView(generics.RetrieveAPIView):
    queryset = Product.objects.filter(is_active=True).select_related('category', 'brand').prefetch_related('images', 'variants', 'category__children', 'interactions')
    serializer_class = ProductSerializer
    lookup_field = 'product_id'
    lookup_url_kwarg = 'id'


class ProductAdminListCreateAPIView(generics.ListCreateAPIView):
    """Admin: List all products (including inactive) and create new ones"""
    queryset = Product.objects.all().select_related('category', 'brand').prefetch_related('images', 'variants')
    serializer_class = ProductAdminSerializer
    permission_classes = []  # TODO: Add IsAdminUser check in production
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def perform_create(self, serializer):
        serializer.save()


class ProductAdminUpdateDeleteAPIView(generics.RetrieveUpdateDestroyAPIView):
    """Admin: Update or delete a specific product"""
    queryset = Product.objects.all()
    serializer_class = ProductAdminSerializer
    lookup_field = 'product_id'
    lookup_url_kwarg = 'id'
    permission_classes = []  # TODO: Add IsAdminUser check in production
    parser_classes = [JSONParser, FormParser, MultiPartParser]


class UserEventCreateAPIView(generics.CreateAPIView):
    queryset = UserInteraction.objects.all()
    serializer_class = UserProductEventSerializer
