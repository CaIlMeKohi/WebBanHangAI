from datetime import timedelta
import secrets

from django.contrib.auth.hashers import check_password, make_password
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from recommendations.services import get_for_you_recommendations

from products.services.email_service import send_order_status_email, send_password_reset_otp, send_verification_email
from products.infrastructure.stored_procedures import (
    recommendation_performance,
    report_best_brands,
    report_best_products,
    report_revenue,
    report_revenue_by_payment_method,
)
from products.business.serializers import (
    AdminUserSerializer,
    NotificationSerializer,
    OrderDetailSerializer,
    PaymentMethodSerializer,
    RecommendationConfigSerializer,
    ReturnRequestSerializer,
)
from products.models import (
    AuditLog,
    CartItem,
    Customer,
    EmailVerificationToken,
    LoginLog,
    Notification,
    Order,
    OrderItem,
    OrderStatusHistory,
    PasswordResetOTP,
    Payment,
    PaymentMethod,
    PrecomputedRecommendation,
    Product,
    ProductVariant,
    RecommendationConfig,
    RecommendationLog,
    ReturnRequest,
    ReturnRequestImage,
    ReturnStatusHistory,
    Review,
    SearchLog,
    Shipment,
    StoreUser,
    UserInteraction,
)
from products.security.permissions import IsAdmin, IsCustomer, IsStaff, IsStoreAuthenticated
from products.serializers import OrderSerializer, ProductSerializer, RegisterSerializer, StoreUserSerializer


def client_ip(request):
    return request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', '')).split(',')[0]


def audit(request, action, entity_type, entity_id='', metadata=None):
    AuditLog.objects.create(actor=getattr(request, 'user', None), action=action, entity_type=entity_type, entity_id=str(entity_id or ''), metadata=metadata or {})


def notify(user, title, content, notification_type='system'):
    return Notification.objects.create(user=user, title=title, content=content, notification_type=notification_type)


class MeAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def get(self, request):
        return Response(StoreUserSerializer(request.user).data)


class LogoutAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def post(self, request):
        return Response({'detail': 'Dang xuat thanh cong. Hay xoa token o client.'})


class VerifyEmailAPIView(APIView):
    def post(self, request):
        token = str(request.data.get('token', '')).strip()
        record = EmailVerificationToken.objects.select_related('user').filter(token=token, used_at__isnull=True).first()
        if record is None or record.expires_at < timezone.now():
            return Response({'detail': 'Token xac thuc khong hop le hoac da het han'}, status=status.HTTP_400_BAD_REQUEST)
        record.used_at = timezone.now()
        record.user.email_verified_at = timezone.now()
        with transaction.atomic():
            record.save(update_fields=['used_at'])
            record.user.save(update_fields=['email_verified_at'])
        return Response({'detail': 'Xac thuc email thanh cong'})


class ResendVerificationAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def post(self, request):
        latest = EmailVerificationToken.objects.filter(user=request.user).order_by('-created_at').first()
        if latest and latest.last_sent_at > timezone.now() - timedelta(seconds=60):
            return Response({'detail': 'Vui long doi 60 giay truoc khi gui lai'}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        token = secrets.token_urlsafe(48)
        EmailVerificationToken.objects.create(user=request.user, token=token, expires_at=timezone.now() + timedelta(hours=24))
        result = send_verification_email(request.user.email, token)
        payload = {'detail': 'Da gui email xac thuc neu Resend da duoc cau hinh'}
        if result.get('skipped'):
            payload['dev_token'] = token
        return Response(payload)


class ForgotPasswordAPIView(APIView):
    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        user = StoreUser.objects.filter(email=email, account_status='active').first()
        if user:
            otp = f'{secrets.randbelow(1_000_000):06d}'
            PasswordResetOTP.objects.create(user=user, otp_hash=make_password(otp), expires_at=timezone.now() + timedelta(minutes=10))
            result = send_password_reset_otp(user.email, otp)
            payload = {'detail': 'OTP da duoc gui neu Resend da duoc cau hinh'}
            if result.get('skipped'):
                payload['dev_otp'] = otp
            return Response(payload)
        return Response({'detail': 'Neu email ton tai, OTP se duoc gui'})


class ResetPasswordAPIView(APIView):
    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        otp = str(request.data.get('otp', '')).strip()
        password = str(request.data.get('password', ''))
        user = StoreUser.objects.filter(email=email, account_status='active').first()
        record = PasswordResetOTP.objects.filter(user=user, used_at__isnull=True).order_by('-created_at').first() if user else None
        if record is None or record.expires_at < timezone.now():
            return Response({'detail': 'OTP khong hop le hoac da het han'}, status=status.HTTP_400_BAD_REQUEST)
        if not check_password(otp, record.otp_hash):
            record.failed_attempts += 1
            if record.failed_attempts >= 3:
                record.used_at = timezone.now()
                record.save(update_fields=['failed_attempts', 'used_at'])
                return Response({'detail': 'OTP da bi huy do nhap sai 3 lan'}, status=status.HTTP_400_BAD_REQUEST)
            record.save(update_fields=['failed_attempts'])
            return Response({'detail': 'OTP khong dung'}, status=status.HTTP_400_BAD_REQUEST)
        if check_password(password, user.password_hash):
            return Response({'detail': 'Mat khau moi khong duoc trung mat khau cu'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = RegisterSerializer(data={'username': user.email, 'full_name': user.email, 'password': password})
        serializer.is_valid(raise_exception=True)
        user.password_hash = make_password(password)
        record.used_at = timezone.now()
        with transaction.atomic():
            user.save(update_fields=['password_hash'])
            record.save(update_fields=['used_at'])
        return Response({'detail': 'Doi mat khau thanh cong'})


class ChangePasswordAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def post(self, request):
        old_password = str(request.data.get('old_password', ''))
        new_password = str(request.data.get('new_password', ''))
        if not check_password(old_password, request.user.password_hash):
            return Response({'detail': 'Mat khau cu khong dung'}, status=status.HTTP_400_BAD_REQUEST)
        if check_password(new_password, request.user.password_hash):
            return Response({'detail': 'Mat khau moi khong duoc trung mat khau cu'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = RegisterSerializer(data={'username': request.user.email, 'full_name': request.user.email, 'password': new_password})
        serializer.is_valid(raise_exception=True)
        request.user.password_hash = make_password(new_password)
        request.user.must_change_password = False
        request.user.save(update_fields=['password_hash', 'must_change_password'])
        return Response({'detail': 'Doi mat khau thanh cong'})


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


class CustomerOrderDetailAPIView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request, order_id):
        order = Order.objects.filter(order_id=order_id, user=request.user).prefetch_related('items', 'status_histories').first()
        if order is None:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrderDetailSerializer(order).data)


class ReviewCreateAPIView(APIView):
    permission_classes = [IsCustomer]

    def post(self, request):
        order_item = OrderItem.objects.select_related('order', 'product').filter(order_item_id=request.data.get('order_item_id'), order__user=request.user, order__status='delivered').first()
        if order_item is None:
            return Response({'detail': 'Chi duoc danh gia san pham da mua trong don delivered'}, status=status.HTTP_400_BAD_REQUEST)
        if Review.objects.filter(user=request.user, product=order_item.product).exists():
            return Response({'detail': 'San pham nay da duoc danh gia'}, status=status.HTTP_400_BAD_REQUEST)
        rating = int(request.data.get('rating', 0))
        if rating < 1 or rating > 5:
            return Response({'detail': 'Rating phai tu 1 den 5'}, status=status.HTTP_400_BAD_REQUEST)
        review = Review.objects.create(user=request.user, product=order_item.product, rating=rating, comment=request.data.get('comment', ''))
        UserInteraction.objects.create(user=request.user, product=order_item.product, interaction_type='review', score=rating)
        return Response({'review_id': review.review_id}, status=status.HTTP_201_CREATED)


class ProductReviewsAPIView(APIView):
    def get(self, request, product_id):
        reviews = Review.objects.filter(product_id=product_id).select_related('user').order_by('-created_at')
        return Response([
            {
                'review_id': item.review_id,
                'user_id': item.user_id,
                'rating': item.rating,
                'comment': item.comment,
                'created_at': item.created_at,
            }
            for item in reviews
        ])


class ReturnRequestListCreateAPIView(APIView):
    permission_classes = [IsCustomer]

    def get(self, request):
        items = ReturnRequest.objects.filter(user=request.user).order_by('-created_at')
        return Response(ReturnRequestSerializer(items, many=True).data)

    @transaction.atomic
    def post(self, request):
        order = Order.objects.filter(order_id=request.data.get('order_id'), user=request.user, status='delivered').first()
        if order is None:
            return Response({'detail': 'Chi duoc doi tra don delivered cua chinh minh'}, status=status.HTTP_400_BAD_REQUEST)
        if order.updated_at < timezone.now() - timedelta(days=7):
            return Response({'detail': 'Da qua thoi han doi tra 7 ngay'}, status=status.HTTP_400_BAD_REQUEST)
        reason = str(request.data.get('reason', '')).strip()
        images = request.data.get('images') or []
        if not reason:
            return Response({'detail': 'Bat buoc nhap ly do'}, status=status.HTTP_400_BAD_REQUEST)
        if not images:
            return Response({'detail': 'Bat buoc co it nhat 1 anh minh chung'}, status=status.HTTP_400_BAD_REQUEST)
        item = ReturnRequest.objects.create(user=request.user, order=order, order_item_id=request.data.get('order_item_id'), reason=reason, desired_solution=request.data.get('desired_solution', ''))
        for image_url in images:
            ReturnRequestImage.objects.create(return_request=item, image_url=str(image_url)[:500])
        ReturnStatusHistory.objects.create(return_request=item, from_status='', to_status='pending', changed_by=request.user)
        notify(request.user, 'Da gui yeu cau doi tra', f'Yeu cau #{item.return_id} dang cho xu ly', 'return')
        return Response(ReturnRequestSerializer(item).data, status=status.HTTP_201_CREATED)


class StaffReturnAPIView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        items = ReturnRequest.objects.all().order_by('-created_at')
        return Response(ReturnRequestSerializer(items, many=True).data)


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
        item.status = next_status
        item.reject_reason = request.data.get('reason', '') if next_status == 'rejected' else item.reject_reason
        item.processed_by = request.user
        item.processed_at = timezone.now()
        item.save(update_fields=['status', 'reject_reason', 'processed_by', 'processed_at', 'updated_at'])
        ReturnStatusHistory.objects.create(return_request=item, from_status=old, to_status=next_status, note=request.data.get('reason', ''), changed_by=request.user)
        notify(item.user, 'Cap nhat yeu cau doi tra', f'Yeu cau #{item.return_id} da chuyen sang {next_status}', 'return')
        return Response(ReturnRequestSerializer(item).data)


class StaffReviewModerateAPIView(APIView):
    permission_classes = [IsStaff]

    def put(self, request, review_id):
        review = Review.objects.filter(review_id=review_id).first()
        if review is None:
            return Response({'detail': 'Review not found'}, status=status.HTTP_404_NOT_FOUND)
        # Schema hien tai chua co status/moderation reason, nen luu ly do vao sentiment_score null va audit log.
        action = request.data.get('action', 'approve')
        audit(request, f'review_{action}', 'review', review_id, {'reason': request.data.get('reason', '')})
        return Response({'detail': 'Da ghi nhan ket qua duyet danh gia'})


class StaffOrderConfirmAPIView(APIView):
    permission_classes = [IsStaff]

    def put(self, request, order_id):
        return StaffOrderStatusAPIView().put(request, order_id)


class StaffOrderStatusAPIView(APIView):
    permission_classes = [IsStaff]
    transitions = {
        'pending': {'confirmed', 'cancelled'},
        'confirmed': {'processing', 'cancelled'},
        'processing': {'shipped', 'cancelled'},
        'shipped': {'delivered'},
    }

    @transaction.atomic
    def put(self, request, order_id):
        order = Order.objects.select_for_update().filter(order_id=order_id).first()
        if order is None:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        next_status = request.data.get('status', 'confirmed')
        if next_status not in self.transitions.get(order.status, set()):
            return Response({'detail': 'Chuyen trang thai khong hop le'}, status=status.HTTP_400_BAD_REQUEST)
        if next_status == 'shipped':
            carrier = str(request.data.get('carrier_name', '')).strip()
            tracking = str(request.data.get('tracking_code', '')).strip()
            if not carrier or not tracking:
                return Response({'detail': 'Can carrier_name va tracking_code khi shipped'}, status=status.HTTP_400_BAD_REQUEST)
            Shipment.objects.update_or_create(order=order, defaults={'carrier_name': carrier, 'tracking_code': tracking, 'shipment_status': 'shipped', 'shipped_at': timezone.now()})
        old = order.status
        order.status = next_status
        order.save(update_fields=['status', 'updated_at'])
        OrderStatusHistory.objects.create(order=order, from_status=old, to_status=next_status, changed_by=request.user)
        notify(order.user, 'Cap nhat don hang', f'Don #{order.order_id} da chuyen sang {next_status}', 'order')
        send_order_status_email(order.user.email, order.order_id, next_status)
        return Response(OrderDetailSerializer(order).data)


class AdminUserViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = AdminUserSerializer
    queryset = StoreUser.objects.all().order_by('-created_at')


class AdminUserLockAPIView(APIView):
    permission_classes = [IsAdmin]

    def put(self, request, user_id):
        user = StoreUser.objects.filter(user_id=user_id).first()
        if user is None:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        user.account_status = 'locked'
        user.save(update_fields=['account_status'])
        audit(request, 'lock_user', 'user', user_id)
        return Response(AdminUserSerializer(user).data)


class AdminUserUnlockAPIView(AdminUserLockAPIView):
    def put(self, request, user_id):
        user = StoreUser.objects.filter(user_id=user_id).first()
        if user is None:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        user.account_status = 'active'
        user.locked_until = None
        user.failed_login_count = 0
        user.save(update_fields=['account_status', 'locked_until', 'failed_login_count'])
        audit(request, 'unlock_user', 'user', user_id)
        return Response(AdminUserSerializer(user).data)


class AdminStaffCreateAPIView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request):
        email = str(request.data.get('email', '')).strip().lower()
        password = str(request.data.get('password', ''))
        role = request.data.get('role', 'staff')
        if role not in {'staff', 'admin'}:
            return Response({'detail': 'Role khong hop le'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = RegisterSerializer(data={'username': email, 'full_name': request.data.get('full_name', email), 'password': password})
        serializer.is_valid(raise_exception=True)
        if len(password) < 12:
            return Response({'detail': 'Mat khau nhan vien/admin toi thieu 12 ky tu'}, status=status.HTTP_400_BAD_REQUEST)
        user = StoreUser.objects.create(email=email, phone=request.data.get('phone') or None, password_hash=make_password(password), role=role, account_status='active', must_change_password=True)
        audit(request, 'create_staff', 'user', user.user_id)
        return Response(AdminUserSerializer(user).data, status=status.HTTP_201_CREATED)


class PaymentMethodViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = PaymentMethodSerializer
    queryset = PaymentMethod.objects.all().order_by('code')


class RecommendationConfigViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = RecommendationConfigSerializer
    queryset = RecommendationConfig.objects.all().order_by('config_key')


class RunRecommendationAPIView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request):
        users = StoreUser.objects.filter(role='customer', account_status='active')
        count = 0
        for user in users:
            products = get_for_you_recommendations(str(user.user_id), limit=10)
            PrecomputedRecommendation.objects.filter(user=user).delete()
            for index, product in enumerate(products, start=1):
                PrecomputedRecommendation.objects.create(user=user, product=product, rank=index, score=max(1, 11 - index), reason='Hybrid theo hanh vi, brand/category va do pho bien', algorithm_type='hybrid')
                count += 1
        audit(request, 'run_recommendations', 'recommendation_job', metadata={'count': count})
        return Response({'generated': count})


class RecommendationMetricsAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        metrics = recommendation_performance(
            from_date=request.query_params.get('from_date'),
            to_date=request.query_params.get('to_date'),
        )
        if 'ctr_percent' in metrics and 'ctr' not in metrics:
            metrics['ctr'] = float(metrics['ctr_percent'] or 0) / 100
        return Response(metrics)


class ReportsRevenueAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        group_by = request.query_params.get('group_by', 'day')
        revenue = report_revenue(from_date=from_date, to_date=to_date, group_by=group_by)
        payment_methods = report_revenue_by_payment_method(from_date=from_date, to_date=to_date)
        return Response({'revenue': revenue, 'payment_methods': payment_methods})


class ReportsBestProductsAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        rows = report_best_products(
            from_date=request.query_params.get('from_date'),
            to_date=request.query_params.get('to_date'),
            top=int(request.query_params.get('top', 20)),
        )
        return Response(rows)


class ReportsBestBrandsAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        rows = report_best_brands(
            from_date=request.query_params.get('from_date'),
            to_date=request.query_params.get('to_date'),
            top=int(request.query_params.get('top', 20)),
        )
        return Response(rows)


class RecommendationEventAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def post(self, request, product_id, event_type):
        product = Product.objects.filter(product_id=product_id, status='active').first()
        if product is None:
            return Response({'detail': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
        RecommendationLog.objects.create(user=request.user, product=product, algorithm_type=event_type, clicked=event_type == 'click')
        return Response({'detail': 'Da ghi log recommendation'})


class PaymentCreateAPIView(APIView):
    permission_classes = [IsStoreAuthenticated]

    def post(self, request):
        order = Order.objects.filter(order_id=request.data.get('order_id'), user=request.user).first()
        if order is None:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        method = request.data.get('method', order.payment_method)
        payment, _ = Payment.objects.get_or_create(order=order, defaults={'amount': order.final_amount, 'payment_method': method, 'status': 'pending'})
        return Response({'payment_id': payment.payment_id, 'status': payment.status, 'amount': payment.amount, 'method': payment.payment_method})


class PaymentCallbackAPIView(APIView):
    def post(self, request, provider):
        order_id = request.data.get('order_id')
        success = str(request.data.get('success', 'false')).lower() in {'true', '1', 'success'}
        payment = Payment.objects.filter(order_id=order_id, payment_method=provider).first()
        if payment is None:
            return Response({'detail': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
        payment.status = 'success' if success else 'failed'
        payment.transaction_id = request.data.get('transaction_id', payment.transaction_id)
        payment.paid_at = timezone.now() if success else payment.paid_at
        payment.save(update_fields=['status', 'transaction_id', 'paid_at'])
        if success:
            payment.order.payment_status = 'paid'
            payment.order.save(update_fields=['payment_status', 'updated_at'])
        return Response({'detail': 'Da xu ly callback thanh toan'})
