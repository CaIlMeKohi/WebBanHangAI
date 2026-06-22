from django.urls import path
from rest_framework.routers import DefaultRouter

from products.business.views import (
    AdminStaffCreateAPIView,
    AdminLowStockAPIView,
    AdminLowStockThresholdAPIView,
    AdminOrderDetailAPIView,
    AdminOrderListAPIView,
    AdminOrderStatusAPIView,
    AdminUserLockAPIView,
    AdminUserUpdateDeleteAPIView,
    AdminUserUnlockAPIView,
    AdminUserViewSet,
    ChangePasswordAPIView,
    CustomerOrderDetailAPIView,
    ForgotPasswordAPIView,
    LogoutAPIView,
    MeAPIView,
    NotificationListAPIView,
    NotificationReadAPIView,
    PaymentMethodViewSet,
    PaymentCallbackAPIView,
    PaymentCreateAPIView,
    ProductReviewsAPIView,
    RecommendationConfigViewSet,
    RecommendationEventAPIView,
    RecommendationMetricsAPIView,
    ReportsBestBrandsAPIView,
    ReportsBestProductsAPIView,
    ReportsOrderStatusAPIView,
    ReportsRevenueAPIView,
    ResendVerificationAPIView,
    ResetPasswordAPIView,
    ReturnRequestListCreateAPIView,
    ReviewCreateAPIView,
    RunRecommendationAPIView,
    StaffOrderConfirmAPIView,
    StaffOrderListAPIView,
    StaffOrderStatusAPIView,
    StaffReturnAPIView,
    StaffReturnStatusAPIView,
    StaffReviewModerateAPIView,
    StaffReviewListAPIView,
    VerifyEmailAPIView,
)
from products.views import AuthLoginAPIView, AuthRegisterAPIView, InventoryAdjustAPIView, LowStockAPIView


admin_router = DefaultRouter()
admin_router.register('users', AdminUserViewSet, basename='admin-users')
admin_router.register('payment-methods', PaymentMethodViewSet, basename='admin-payment-methods')
admin_router.register('recommendation-configs', RecommendationConfigViewSet, basename='admin-recommendation-configs')


auth_patterns = [
    path('register', AuthRegisterAPIView.as_view()),
    path('login', AuthLoginAPIView.as_view()),
    path('logout', LogoutAPIView.as_view()),
    path('verify-email', VerifyEmailAPIView.as_view()),
    path('resend-verification', ResendVerificationAPIView.as_view()),
    path('forgot-password', ForgotPasswordAPIView.as_view()),
    path('reset-password', ResetPasswordAPIView.as_view()),
    path('change-password', ChangePasswordAPIView.as_view()),
    path('me', MeAPIView.as_view()),
]

customer_patterns = [
    path('orders/<int:order_id>', CustomerOrderDetailAPIView.as_view()),
]

return_patterns = [
    path('', ReturnRequestListCreateAPIView.as_view()),
    path('my', ReturnRequestListCreateAPIView.as_view()),
]

review_patterns = [
    path('', ReviewCreateAPIView.as_view()),
]

product_review_patterns = [
    path('<int:product_id>/reviews', ProductReviewsAPIView.as_view()),
]

payment_patterns = [
    path('create', PaymentCreateAPIView.as_view()),
    path('<str:provider>/callback', PaymentCallbackAPIView.as_view()),
]

staff_patterns = [
    path('orders', StaffOrderListAPIView.as_view()),
    path('orders/<int:order_id>/confirm', StaffOrderConfirmAPIView.as_view()),
    path('orders/<int:order_id>/status', StaffOrderStatusAPIView.as_view()),
    path('orders/<int:order_id>/shipment', StaffOrderStatusAPIView.as_view()),
    path('reviews/<int:review_id>/moderate', StaffReviewModerateAPIView.as_view()),
    path('reviews', StaffReviewListAPIView.as_view()),
    path('returns', StaffReturnAPIView.as_view()),
    path('returns/<int:return_id>/status', StaffReturnStatusAPIView.as_view()),
    path('inventory/import', InventoryAdjustAPIView.as_view()),
    path('inventory/adjust', InventoryAdjustAPIView.as_view()),
    path('inventory/low-stock', LowStockAPIView.as_view()),
]

admin_patterns = [
    path('staffs', AdminStaffCreateAPIView.as_view()),
    path('users/<int:user_id>/lock', AdminUserLockAPIView.as_view()),
    path('users/<int:user_id>/unlock', AdminUserUnlockAPIView.as_view()),
    path('users/<int:user_id>', AdminUserUpdateDeleteAPIView.as_view()),
    path('orders', AdminOrderListAPIView.as_view()),
    path('orders/<int:order_id>', AdminOrderDetailAPIView.as_view()),
    path('orders/<int:order_id>/status', AdminOrderStatusAPIView.as_view()),
    path('inventory/low-stock', AdminLowStockAPIView.as_view()),
    path('inventory/low-stock-threshold', AdminLowStockThresholdAPIView.as_view()),
    path('reports/revenue', ReportsRevenueAPIView.as_view()),
    path('reports/best-products', ReportsBestProductsAPIView.as_view()),
    path('reports/best-brands', ReportsBestBrandsAPIView.as_view()),
    path('reports/order-status', ReportsOrderStatusAPIView.as_view()),
    path('reports/recommendations', RecommendationMetricsAPIView.as_view()),
    path('recommendations/run', RunRecommendationAPIView.as_view()),
]

notification_patterns = [
    path('', NotificationListAPIView.as_view()),
    path('<int:notification_id>/read', NotificationReadAPIView.as_view()),
]

recommendation_patterns = [
    path('<int:product_id>/impression', RecommendationEventAPIView.as_view(), {'event_type': 'impression'}),
    path('<int:product_id>/click', RecommendationEventAPIView.as_view(), {'event_type': 'click'}),
]

urlpatterns = auth_patterns
