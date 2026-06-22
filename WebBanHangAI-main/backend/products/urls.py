from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    AdminBrandViewSet,
    AdminCategoryViewSet,
    AdminCouponViewSet,
    AdminVariantViewSet,
    AuthLoginAPIView,
    AuthRegisterAPIView,
    AddressDetailAPIView,
    AddressListCreateAPIView,
    CartAPIView,
    CartClearAPIView,
    CartItemAPIView,
    ApplyCouponAPIView,
    BrandListAPIView,
    CategoryListAPIView,
    InventoryAdjustAPIView,
    LowStockAPIView,
    StockVariantListAPIView,
    OrderListCreateAPIView,
    OrderCancelAPIView,
    OrderConfirmReceivedAPIView,
    OrderDetailAPIView,
    ProductDetailAPIView,
    ProductListAPIView,
    ProfileAPIView,
    StaffOrderListAPIView,
    StaffOrderStatusAPIView,
    UserEventCreateAPIView,
    ProductAdminListCreateAPIView,
    ProductAdminUpdateDeleteAPIView,
    ProductAdminHistoryAPIView,
    WishlistAPIView,
)
from .interfaces.api.wishlist_views import WishlistItemAPIView

router = DefaultRouter()
router.register('admin/categories', AdminCategoryViewSet, basename='admin-categories')
router.register('admin/brands', AdminBrandViewSet, basename='admin-brands')
router.register('admin/product-variants', AdminVariantViewSet, basename='admin-product-variants')
router.register('admin/coupons', AdminCouponViewSet, basename='admin-coupons')

urlpatterns = [
    path('', ProductListAPIView.as_view(), name='product-list'),
    path('auth/login/', AuthLoginAPIView.as_view(), name='auth-login'),
    path('auth/register/', AuthRegisterAPIView.as_view(), name='auth-register'),
    path('categories/', CategoryListAPIView.as_view(), name='category-list'),
    path('brands/', BrandListAPIView.as_view(), name='brand-list'),
    path('profile/', ProfileAPIView.as_view(), name='profile'),
    path('addresses/', AddressListCreateAPIView.as_view(), name='address-list-create'),
    path('addresses/<int:address_id>/', AddressDetailAPIView.as_view(), name='address-detail'),
    path('cart/', CartAPIView.as_view(), name='cart'),
    path('cart/clear/', CartClearAPIView.as_view(), name='cart-clear'),
    path('cart/apply-coupon/', ApplyCouponAPIView.as_view(), name='cart-apply-coupon'),
    path('cart/<int:item_id>/', CartItemAPIView.as_view(), name='cart-item'),
    path('wishlist/', WishlistAPIView.as_view(), name='wishlist'),
    path('wishlist/<int:product_id>/', WishlistItemAPIView.as_view(), name='wishlist-item'),
    path('orders/', OrderListCreateAPIView.as_view(), name='order-list-create'),
    path('orders/<int:order_id>/', OrderDetailAPIView.as_view(), name='order-detail'),
    path('orders/<int:order_id>/cancel/', OrderCancelAPIView.as_view(), name='order-cancel'),
    path('orders/<int:order_id>/confirm-received/', OrderConfirmReceivedAPIView.as_view(), name='order-confirm-received'),
    path('staff/orders/', StaffOrderListAPIView.as_view(), name='staff-order-list'),
    path('staff/orders/<int:order_id>/status/', StaffOrderStatusAPIView.as_view(), name='staff-order-status'),
    path('staff/inventory/adjust/', InventoryAdjustAPIView.as_view(), name='staff-inventory-adjust'),
    path('staff/inventory/import/', InventoryAdjustAPIView.as_view(), name='staff-inventory-import'),
    path('staff/inventory/variants/', StockVariantListAPIView.as_view(), name='staff-inventory-variants'),
    path('staff/inventory/low-stock/', LowStockAPIView.as_view(), name='staff-inventory-low-stock'),
    path('events/', UserEventCreateAPIView.as_view(), name='product-event-create'),
    # Admin endpoints
    path('admin/products/', ProductAdminListCreateAPIView.as_view(), name='product-admin-list-create'),
    path('admin/products/<str:id>/history/', ProductAdminHistoryAPIView.as_view(), name='product-admin-history'),
    path('admin/products/<str:id>/', ProductAdminUpdateDeleteAPIView.as_view(), name='product-admin-update-delete'),
    path('', include(router.urls)),
    path('<str:id>/', ProductDetailAPIView.as_view(), name='product-detail'),
]
