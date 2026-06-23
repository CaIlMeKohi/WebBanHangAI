import secrets

from django.db import DatabaseError, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from products.services.email_service import send_order_status_email
from products.infrastructure.stored_procedures import (
    cancel_order_and_restore_stock,
    low_stock_variants,
    refund_order,
    update_order_status,
)
from products.interfaces.api.order_views import (
    AdminOrderDetailAPIView as CleanAdminOrderDetailAPIView,
    AdminOrderListAPIView as CleanAdminOrderListAPIView,
    CustomerOrderConfirmReceivedAPIView as CleanCustomerOrderConfirmReceivedAPIView,
    CustomerOrderDetailAPIView as CleanCustomerOrderDetailAPIView,
    StaffOrderListAPIView as CleanStaffOrderListAPIView,
)
from products.interfaces.api.review_views import (
    AdminReviewDeleteAPIView as CleanAdminReviewDeleteAPIView,
    ProductReviewsAPIView as CleanProductReviewsAPIView,
    ReviewCreateAPIView as CleanReviewCreateAPIView,
    StaffReviewListAPIView as CleanStaffReviewListAPIView,
)
from products.interfaces.api.recommendation_views import (
    RecommendationEventAPIView as CleanRecommendationEventAPIView,
    RecommendationMetricsAPIView as CleanRecommendationMetricsAPIView,
    RunRecommendationAPIView as CleanRunRecommendationAPIView,
)
from products.interfaces.api.return_views import (
    ReturnRequestListCreateAPIView as CleanReturnRequestListCreateAPIView,
    StaffReturnAPIView as CleanStaffReturnAPIView,
)
from products.interfaces.api.payment_views import (
    PaymentStatusAPIView as CleanPaymentStatusAPIView,
    PaymentCreateAPIView as CleanPaymentCreateAPIView,
    PayOSWebhookAPIView as CleanPayOSWebhookAPIView,
    ReorderAsCODAPIView as CleanReorderAsCODAPIView,
    SwitchPaymentToCODAPIView as CleanSwitchPaymentToCODAPIView,
)
from products.interfaces.api.report_views import (
    ReportsBestBrandsAPIView as CleanReportsBestBrandsAPIView,
    ReportsBestProductsAPIView as CleanReportsBestProductsAPIView,
    ReportsOrderStatusAPIView as CleanReportsOrderStatusAPIView,
    ReportsRevenueAPIView as CleanReportsRevenueAPIView,
)
from products.interfaces.api.admin_config_views import (
    PaymentMethodViewSet as CleanPaymentMethodViewSet,
    RecommendationConfigViewSet as CleanRecommendationConfigViewSet,
)
from products.interfaces.api.user_views import (
    AdminStaffCreateAPIView as CleanAdminStaffCreateAPIView,
    AdminUserLockAPIView as CleanAdminUserLockAPIView,
    AdminUserUnlockAPIView as CleanAdminUserUnlockAPIView,
    AdminUserUpdateDeleteAPIView as CleanAdminUserUpdateDeleteAPIView,
    AdminUserViewSet as CleanAdminUserViewSet,
    LogoutAPIView as CleanLogoutAPIView,
    MeAPIView as CleanMeAPIView,
)
from products.interfaces.api.auth_security_views import (
    ChangePasswordAPIView as CleanChangePasswordAPIView,
    ForgotPasswordAPIView as CleanForgotPasswordAPIView,
    ResendVerificationAPIView as CleanResendVerificationAPIView,
    ResetPasswordAPIView as CleanResetPasswordAPIView,
    VerifyEmailAPIView as CleanVerifyEmailAPIView,
)
from products.business.serializers import (
    AdminLowStockThresholdSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
    NotificationSerializer,
    OrderDetailSerializer,
    ReturnRequestSerializer,
)
from products.models import (
    AuditLog,
    CartItem,
    Customer,
    LoginLog,
    Notification,
    Order,
    OrderItem,
    OrderStatusHistory,
    ProductVariant,
    ReturnRequest,
    ReturnRequestImage,
    ReturnStatusHistory,
    Review,
    SearchLog,
    Shipment,
    StaffProfile,
    StoreUser,
    UserInteraction,
    UserSession,
)
from products.security.permissions import IsAdmin, IsCustomer, IsStaff, IsStoreAuthenticated
from products.serializers import OrderSerializer, ProductSerializer, RegisterSerializer, StoreUserSerializer


def client_ip(request):
    return request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0]


def audit(request, action, entity_type, entity_id='', metadata=None, old_value=None):
    AuditLog.objects.create(
        actor=getattr(request, 'user', None),
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id or ''),
        old_value=old_value,
        metadata=metadata or {},
        ip_address=client_ip(request),
        user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
    )


def notify(user, title, content, notification_type='system'):
    return Notification.objects.create(user=user, title=title, content=content, notification_type=notification_type)


def customer_for(user):
    return Customer.objects.filter(user=user).first()


def staff_for(user):
    profile, _ = StaffProfile.objects.get_or_create(
        user=user,
        defaults={
            'staff_code': f'NV{user.user_id:06d}',
            'full_name': user.email,
            'position': 'staff',
            'department': 'operations',
        },
    )
    return profile


class MeAPIView(CleanMeAPIView):
    """Compatibility wrapper for current user endpoint."""


class LogoutAPIView(CleanLogoutAPIView):
    """Compatibility wrapper for logout endpoint."""


class VerifyEmailAPIView(CleanVerifyEmailAPIView):
    """Compatibility wrapper for verify email."""


class ResendVerificationAPIView(CleanResendVerificationAPIView):
    """Compatibility wrapper for resend verification."""


class ForgotPasswordAPIView(CleanForgotPasswordAPIView):
    """Compatibility wrapper for forgot password."""


class ResetPasswordAPIView(CleanResetPasswordAPIView):
    """Compatibility wrapper for reset password."""


class ChangePasswordAPIView(CleanChangePasswordAPIView):
    """Compatibility wrapper for change password."""


class NotificationListAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def get(self, request):
        items = Notification.objects.filter(user=request.user).order_by('-created_at')
        return Response(NotificationSerializer(items, many=True).data)


class NotificationReadAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def put(self, request, notification_id):
        Notification.objects.filter(user=request.user, notification_id=notification_id).update(is_read=True)
        return Response({'detail': 'Da danh dau da doc'})

    def delete(self, request, notification_id):
        Notification.objects.filter(user=request.user, notification_id=notification_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CustomerOrderDetailAPIView(CleanCustomerOrderDetailAPIView):
    """Compatibility wrapper for the existing /api/customer/orders/<id> route."""


class OrderConfirmReceivedAPIView(CleanCustomerOrderConfirmReceivedAPIView):
    """Compatibility wrapper for customer order received confirmation."""


class ReviewCreateAPIView(CleanReviewCreateAPIView):
    """Compatibility wrapper for the existing review create route."""


class ProductReviewsAPIView(CleanProductReviewsAPIView):
    """Compatibility wrapper for the existing product reviews route."""


class ReturnRequestListCreateAPIView(CleanReturnRequestListCreateAPIView):
    """Compatibility wrapper for customer return list/create."""

    @transaction.atomic
    def post(self, request):
        response = super().post(request)
        if response.status_code == status.HTTP_201_CREATED:
            return_id = response.data.get('return_id')
            notify(request.user, 'Da gui yeu cau doi tra', f'Yeu cau #{return_id} dang cho xu ly', 'return')
        return response


class StaffReturnAPIView(CleanStaffReturnAPIView):
    """Compatibility wrapper for staff return list."""


class StaffOrderListAPIView(CleanStaffOrderListAPIView):
    """Compatibility wrapper for the existing staff order list route."""


class StaffReturnStatusAPIView(APIView):
    permission_classes = [IsStaff]

    @transaction.atomic
    def put(self, request, return_id):
        item = ReturnRequest.objects.select_for_update().filter(return_id=return_id).first()
        if item is None:
            return Response({'detail': 'Return request not found'}, status=status.HTTP_404_NOT_FOUND)
        next_status = request.data.get('status')
        if next_status not in {'approved', 'rejected', 'completed'}:
            return Response({'detail': 'Trang thai khong hop le'}, status=status.HTTP_400_BAD_REQUEST)
        if next_status == 'rejected' and not request.data.get('reason'):
            return Response({'detail': 'Tu choi phai ghi ly do'}, status=status.HTTP_400_BAD_REQUEST)
        old = item.status
        is_cancel_request = item.desired_solution == 'cancel_order'
        if is_cancel_request and old != 'pending':
            return Response({'detail': 'Yeu cau huy don da duoc xu ly'}, status=status.HTTP_400_BAD_REQUEST)
        if is_cancel_request and next_status not in {'approved', 'rejected'}:
            return Response({'detail': 'Yeu cau huy don chi co the duyet hoac tu choi'}, status=status.HTTP_400_BAD_REQUEST)
        if is_cancel_request and next_status == 'approved':
            if item.order.status not in {'pending', 'confirmed', 'processing'}:
                return Response({'detail': 'Don hang khong con o trang thai co the huy'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                cancel_order_and_restore_stock(
                    item.order_id,
                    request.user.user_id,
                    item.reason or f'Customer cancellation request #{item.return_id}',
                )
            except DatabaseError:
                transaction.set_rollback(True)
                return Response({'detail': 'Khong the huy don va hoan kho'}, status=status.HTTP_400_BAD_REQUEST)
        item.status = next_status
        item.reject_reason = request.data.get('reason', '') if next_status == 'rejected' else item.reject_reason
        item.processed_by = staff_for(request.user)
        item.processed_at = timezone.now()
        item.save(update_fields=['status', 'reject_reason', 'processed_by', 'processed_at'])
        ReturnStatusHistory.objects.create(return_request=item, from_status=old, to_status=next_status, changed_by=request.user)
        if next_status == 'completed':
            try:
                refund_order(
                    item.order_id,
                    request.user.user_id,
                    request.data.get('reason') or f'Return request #{item.return_id} completed',
                    restore_stock=True,
                )
            except DatabaseError:
                transaction.set_rollback(True)
                return Response({'detail': 'Khong the hoan tien/nhap lai kho cho yeu cau doi tra'}, status=status.HTTP_400_BAD_REQUEST)
        if is_cancel_request:
            if next_status == 'approved':
                notify(item.user.user, 'Hủy đơn thành công', f'Đơn hàng #{item.order_id} đã được nhân viên duyệt hủy.', 'order_cancel')
            else:
                notify(item.user.user, 'Yêu cầu hủy đơn bị từ chối', f'Đơn hàng #{item.order_id} chưa được hủy. Lý do: {item.reject_reason}', 'order_cancel')
        else:
            notify(item.user.user, 'Cap nhat yeu cau doi tra', f'Yeu cau #{item.return_id} da chuyen sang {next_status}', 'return')
        return Response(ReturnRequestSerializer(item).data)


class StaffReviewModerateAPIView(APIView):
    permission_classes = [IsAdmin]

    def put(self, request, review_id):
        review = Review.objects.filter(review_id=review_id).first()
        if review is None:
            return Response({'detail': 'Review not found'}, status=status.HTTP_404_NOT_FOUND)
        action = request.data.get('action', 'approve')
        if action not in {'approve', 'hide'}:
            return Response({'detail': 'Action phai la approve hoac hide'}, status=status.HTTP_400_BAD_REQUEST)
        reason = str(request.data.get('reason', '')).strip()
        if action == 'hide' and not reason:
            return Response({'detail': 'An danh gia bat buoc ghi ly do'}, status=status.HTTP_400_BAD_REQUEST)
        review.status = 'visible' if action == 'approve' else 'hidden'
        review.hidden_reason = reason if action == 'hide' else ''
        review.moderated_by_staff = staff_for(request.user)
        review.save(update_fields=['status', 'hidden_reason', 'moderated_by_staff', 'updated_at'])
        audit(request, f'review_{action}', 'review', review_id, {'reason': request.data.get('reason', '')})
        return Response({'detail': 'Da ghi nhan ket qua duyet danh gia'})


class StaffReviewListAPIView(CleanStaffReviewListAPIView):
    """Compatibility wrapper for the existing staff review list route."""


class AdminReviewDeleteAPIView(CleanAdminReviewDeleteAPIView):
    """Admin-only endpoint for deleting product reviews."""


class StaffOrderConfirmAPIView(APIView):
    permission_classes = [IsStaff]

    def put(self, request, order_id):
        order = Order.objects.select_related('address').prefetch_related('items__variant').filter(order_id=order_id, status='pending').first()
        if order is None:
            return Response({'detail': 'Chi xac nhan don pending ton tai'}, status=status.HTTP_400_BAD_REQUEST)
        if not order.receiver_phone_snapshot or not order.address_line_snapshot:
            return Response({'detail': 'Don hang thieu dia chi hoac so dien thoai giao hang'}, status=status.HTTP_400_BAD_REQUEST)
        for item in order.items.all():
            if item.variant.stock_quantity < 0:
                return Response({'detail': f'Ton kho SKU {item.sku_snapshot} khong hop le'}, status=status.HTTP_400_BAD_REQUEST)
        return StaffOrderStatusAPIView().put(request, order_id)


class StaffOrderStatusAPIView(APIView):
    permission_classes = [IsStaff]
    transitions = {
        'pending': {'confirmed', 'cancelled'},
        'confirmed': {'processing', 'cancelled'},
        'processing': {'waiting_pickup', 'cancelled'},
        'waiting_pickup': {'shipped'},
        'shipped': {'delivered'},
        'delivered': {'completed'},
    }

    def put(self, request, order_id):
        order = Order.objects.filter(order_id=order_id).first()
        if order is None:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        shipment_before = Shipment.objects.filter(order_id=order_id).first()
        old_value = {
            'status': order.status,
            'payment_status': order.payment_status,
            'carrier_name': shipment_before.carrier_name if shipment_before else '',
            'tracking_code': shipment_before.tracking_code if shipment_before else '',
            'shipment_status': shipment_before.shipment_status if shipment_before else '',
        }
        next_status = request.data.get('status', 'confirmed')
        if next_status not in self.transitions.get(order.status, set()):
            return Response({'detail': 'Chuyen trang thai khong hop le'}, status=status.HTTP_400_BAD_REQUEST)
        carrier = None
        tracking_code = str(request.data.get('tracking_code', '')).strip()
        if next_status == 'waiting_pickup':
            carrier = str(request.data.get('carrier_name', '')).strip()
            if not carrier:
                return Response({'detail': 'Cần nhập đơn vị vận chuyển khi giao hàng'}, status=status.HTTP_400_BAD_REQUEST)
            if not tracking_code:
                tracking_code = f'BKQ{timezone.now().strftime("%y%m%d")}{secrets.token_hex(3).upper()}'
        note = str(request.data.get('note', '')).strip()
        try:
            if next_status == 'cancelled':
                cancel_order_and_restore_stock(order.order_id, request.user.user_id if request.user else None, note or 'Staff cancelled order')
            else:
                update_order_status(
                    order.order_id,
                    next_status,
                    request.user.user_id if request.user else None,
                    carrier,
                    tracking_code or None,
                    note or None,
                )
        except DatabaseError:
            return Response({'detail': 'Không thể cập nhật trạng thái đơn hàng'}, status=status.HTTP_400_BAD_REQUEST)
        order = Order.objects.filter(order_id=order_id).prefetch_related('items', 'items__product', 'status_histories').first()
        shipment_after = Shipment.objects.filter(order_id=order_id).first()
        audit(
            request,
            'update_order_status',
            'order',
            order.order_id,
            {
                'status': order.status,
                'payment_status': order.payment_status,
                'carrier_name': shipment_after.carrier_name if shipment_after else '',
                'tracking_code': shipment_after.tracking_code if shipment_after else '',
                'shipment_status': shipment_after.shipment_status if shipment_after else '',
                'note': note,
            },
            old_value=old_value,
        )
        notify(order.user.user, 'Cap nhat don hang', f'Don #{order.order_id} da chuyen sang {next_status}', 'order')
        send_order_status_email(order.user.user.email, order.order_id, next_status)
        return Response(OrderDetailSerializer(order).data)

class AdminOrderListAPIView(CleanAdminOrderListAPIView):
    """Compatibility wrapper for the existing admin order list route."""


class AdminOrderDetailAPIView(CleanAdminOrderDetailAPIView):
    """Compatibility wrapper for the existing admin order detail route."""


class AdminOrderStatusAPIView(StaffOrderStatusAPIView):
    permission_classes = [IsAdmin]

    def put(self, request, order_id):
        order = Order.objects.filter(order_id=order_id).first()
        if order is None:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        if order.status == 'delivered' and not order.return_requests.exists():
            return Response({'detail': 'Admin chi can thiep don delivered khi co khieu nai/doi tra'}, status=status.HTTP_400_BAD_REQUEST)
        return super().put(request, order_id)


class AdminUserViewSet(CleanAdminUserViewSet):
    """Compatibility wrapper for admin users list."""


class AdminUserLockAPIView(CleanAdminUserLockAPIView):
    """Compatibility wrapper for admin user lock."""

    def put(self, request, user_id):
        response = super().put(request, user_id)
        if response.status_code == status.HTTP_200_OK:
            audit(request, 'lock_user', 'user', user_id)
        return response


class AdminUserUnlockAPIView(CleanAdminUserUnlockAPIView):
    def put(self, request, user_id):
        response = super().put(request, user_id)
        if response.status_code == status.HTTP_200_OK:
            audit(request, 'unlock_user', 'user', user_id)
        return response


class AdminUserUpdateDeleteAPIView(CleanAdminUserUpdateDeleteAPIView):
    """Compatibility wrapper for admin user update/delete."""

    @transaction.atomic
    def put(self, request, user_id):
        response = super().put(request, user_id)
        if response.status_code == status.HTTP_200_OK:
            audit(request, 'update_user', 'user', user_id, {'fields': getattr(response, 'changed_fields', [])})
        return response

    @transaction.atomic
    def delete(self, request, user_id):
        response = super().delete(request, user_id)
        if response.status_code == status.HTTP_204_NO_CONTENT:
            audit(request, 'delete_user', 'user', user_id, {'account_status': 'inactive'}, getattr(response, 'old_value', None))
        return response


class AdminStaffCreateAPIView(CleanAdminStaffCreateAPIView):
    """Compatibility wrapper for admin staff/admin creation."""

    @transaction.atomic
    def post(self, request):
        response = super().post(request)
        if response.status_code == status.HTTP_201_CREATED:
            audit(request, 'create_staff', 'user', response.data.get('user_id'))
        return response


class AdminAuditLogAPIView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        entity_type = request.query_params.get('entity_type')
        actions = request.query_params.getlist('action')
        queryset = AuditLog.objects.select_related('actor').order_by('-created_at')
        if getattr(request.user, 'role', '') == 'staff':
            queryset = queryset.filter(actor__role='staff')
        if entity_type:
            queryset = queryset.filter(entity_type=entity_type)
        if actions:
            queryset = queryset.filter(action__in=actions)

        items = queryset[:200]
        return Response([
            {
                'audit_id': item.audit_id,
                'action': item.action,
                'entity_type': item.entity_type,
                'entity_id': item.entity_id,
                'actor_email': item.actor.email if item.actor_id else None,
                'old_value': item.old_value,
                'metadata': item.metadata,
                'created_at': item.created_at,
            }
            for item in items
        ])


class PaymentMethodViewSet(CleanPaymentMethodViewSet):
    """Compatibility wrapper for payment method config."""

    def perform_create(self, serializer):
        item = serializer.save()
        audit(self.request, 'create_payment_method', 'payment_method', item.method_id)

    def perform_update(self, serializer):
        item = serializer.save()
        audit(self.request, 'update_payment_method', 'payment_method', item.method_id)


class RecommendationConfigViewSet(CleanRecommendationConfigViewSet):
    """Compatibility wrapper for recommendation config."""

    def perform_create(self, serializer):
        item = serializer.save()
        audit(self.request, 'create_recommendation_config', 'recommendation_config', item.config_id)

    def perform_update(self, serializer):
        item = serializer.save()
        audit(self.request, 'update_recommendation_config', 'recommendation_config', item.config_id)


class AdminLowStockAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        return Response(low_stock_variants())


class AdminLowStockThresholdAPIView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
    def put(self, request):
        serializer = AdminLowStockThresholdSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        threshold = serializer.validated_data['threshold']
        variant_id = request.data.get('variant_id')
        queryset = ProductVariant.objects.select_for_update()
        if variant_id:
            updated = queryset.filter(variant_id=variant_id).update(low_stock_threshold=threshold, updated_at=timezone.now())
        else:
            updated = queryset.update(low_stock_threshold=threshold, updated_at=timezone.now())
        audit(request, 'update_low_stock_threshold', 'product_variants', variant_id or 'all', {'threshold': threshold, 'updated': updated})
        return Response({'updated': updated, 'threshold': threshold})


class RunRecommendationAPIView(CleanRunRecommendationAPIView):
    """Compatibility wrapper for recommendation batch run."""

    @transaction.atomic
    def post(self, request):
        response = super().post(request)
        if response.status_code == status.HTTP_200_OK:
            top_n = max(1, min(int(request.data.get('top_n', 10)), 100))
            cold_start_threshold = max(1, min(int(request.data.get('cold_start_threshold', 5)), 100))
            audit(
                request,
                'run_recommendations',
                'recommendation_job',
                metadata={'count': response.data.get('generated', 0), 'top_n': top_n, 'cold_start_threshold': cold_start_threshold},
            )
        return response


class RecommendationMetricsAPIView(CleanRecommendationMetricsAPIView):
    """Compatibility wrapper for recommendation metrics."""


class ReportsRevenueAPIView(CleanReportsRevenueAPIView):
    """Compatibility wrapper for revenue report."""


class ReportsOrderStatusAPIView(CleanReportsOrderStatusAPIView):
    """Compatibility wrapper for order status report."""


class ReportsBestProductsAPIView(CleanReportsBestProductsAPIView):
    """Compatibility wrapper for best products report."""


class ReportsBestBrandsAPIView(CleanReportsBestBrandsAPIView):
    """Compatibility wrapper for best brands report."""


class RecommendationEventAPIView(CleanRecommendationEventAPIView):
    """Compatibility wrapper for recommendation impression/click events."""


class PaymentCreateAPIView(CleanPaymentCreateAPIView):
    """Compatibility wrapper for payment create route."""


class PayOSWebhookAPIView(CleanPayOSWebhookAPIView):
    """Compatibility wrapper for the signed payOS webhook route."""


class PaymentStatusAPIView(CleanPaymentStatusAPIView):
    """Compatibility wrapper for customer payment status."""


class SwitchPaymentToCODAPIView(CleanSwitchPaymentToCODAPIView):
    """Compatibility wrapper for switching an unpaid payOS order to COD."""


class ReorderAsCODAPIView(CleanReorderAsCODAPIView):
    """Compatibility wrapper for recreating an expired order as COD."""
