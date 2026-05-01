from django.urls import path

from .views import (
    ProductDetailAPIView,
    ProductListAPIView,
    UserEventCreateAPIView,
    ProductAdminListCreateAPIView,
    ProductAdminUpdateDeleteAPIView,
)

urlpatterns = [
    path('', ProductListAPIView.as_view(), name='product-list'),
    path('events/', UserEventCreateAPIView.as_view(), name='product-event-create'),
    path('<str:id>/', ProductDetailAPIView.as_view(), name='product-detail'),
    # Admin endpoints
    path('admin/products/', ProductAdminListCreateAPIView.as_view(), name='product-admin-list-create'),
    path('admin/products/<str:id>/', ProductAdminUpdateDeleteAPIView.as_view(), name='product-admin-update-delete'),
]
