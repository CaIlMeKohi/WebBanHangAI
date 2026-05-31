from datetime import timedelta
import secrets

from django.contrib.auth.hashers import check_password, make_password
from django.db import DatabaseError, connection, models, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from recommendations.services import get_for_you_recommendations

from products.services.email_service import send_order_status_email, send_password_reset_otp, send_verification_email
from products.infrastructure.stored_procedures import (
    low_stock_variants,
    recommendation_performance,
    run_recommendation_batch,
    report_best_brands,
    report_best_products,
    report_revenue,
    report_revenue_by_payment_method,
)
from products.business.serializers import (
    AdminLowStockThresholdSerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
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


def table_exists(table_name):
    try:
        return table_name in connection.introspection.table_names()
    except DatabaseError:
        return False


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
        customer = Customer.objects.filter(user=request.user).first()
        UserInteraction.objects.create(user=customer, product=order_item.product, interaction_type='review', score=rating)
        return Response({'review_id': review.review_id}, status=status.HTTP_201_CREATED)


class ProductReviewsAPIView(APIView):
    def get(self, request, product_id):
        reviews = Review.objects.filter(product_id=product_id, status='visible').select_related('user').order_by('-created_at')
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
        item = ReturnRequest.objects.create(
            user=request.user,
            order=order,
            order_item_id=request.data.get('order_item_id'),
            reason=reason,
            desired_solution=request.data.get('desired_solution', ''),
            evidence_image_urls=','.join(str(image_url)[:500] for image_url in images),
        )
        notify(request.user, 'Da gui yeu cau doi tra', f'Yeu cau #{item.return_id} dang cho xu ly', 'return')
        return Response(ReturnRequestSerializer(item).data, status=status.HTTP_201_CREATED)


class StaffReturnAPIView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        items = ReturnRequest.objects.all().order_by('-created_at')
        return Response(ReturnRequestSerializer(items, many=True).data)


class StaffOrderListAPIView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        orders = Order.objects.filter(status__in=['pending', 'confirmed', 'processing']).prefetch_related('items', 'items__product').order_by('-created_at')
        order_status = request.query_params.get('status')
        payment_method = request.query_params.get('payment_method')
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        if order_status:
            orders = orders.filter(status=order_status)
        if payment_method:
            orders = orders.filter(payment_method=payment_method)
        if from_date:
            orders = orders.filter(created_at__date__gte=from_date)
        if to_date:
            orders = orders.filter(created_at__date__lte=to_date)
        return Response(OrderDetailSerializer(orders[:200], many=True).data)


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
        item.save(update_fields=['status', 'reject_reason', 'processed_by', 'processed_at'])
        notify(item.user, 'Cap nhat yeu cau doi tra', f'Yeu cau #{item.return_id} da chuyen sang {next_status}', 'return')
        return Response(ReturnRequestSerializer(item).data)


class StaffReviewModerateAPIView(APIView):
    permission_classes = [IsStaff]

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
        review.moderated_by_staff = request.user
        review.save(update_fields=['status', 'hidden_reason', 'moderated_by_staff', 'updated_at'])
        audit(request, f'review_{action}', 'review', review_id, {'reason': request.data.get('reason', '')})
        return Response({'detail': 'Da ghi nhan ket qua duyet danh gia'})


class StaffReviewListAPIView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        reviews = Review.objects.select_related('product', 'user').order_by('-created_at')
        review_status = request.query_params.get('status')
        if review_status:
            reviews = reviews.filter(status=review_status)
        return Response([
            {
                'review_id': item.review_id,
                'product_id': item.product_id,
                'product_name': item.product.name,
                'customer_id': item.user_id,
                'rating': item.rating,
                'comment': item.comment,
                'status': item.status,
                'hidden_reason': item.hidden_reason,
                'created_at': item.created_at,
            }
            for item in reviews[:200]
        ])


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
            Shipment.objects.update_or_create(order=order, defaults={'carrier_name': carrier, 'tracking_code': tracking, 'shipment_status': 'shipped', 'shipped_at': timezone.now(), 'created_by_staff': request.user})
        old = order.status
        order.status = next_status
        order.save(update_fields=['status', 'updated_at'])
        OrderStatusHistory.objects.create(order=order, from_status=old, to_status=next_status, changed_by=request.user)
        notify(order.user.user, 'Cap nhat don hang', f'Don #{order.order_id} da chuyen sang {next_status}', 'order')
        send_order_status_email(order.user.user.email, order.order_id, next_status)
        return Response(OrderDetailSerializer(order).data)


class AdminOrderListAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        orders = Order.objects.select_related('user', 'user__user', 'address').prefetch_related('items', 'items__product', 'status_histories').order_by('-created_at')
        status_filter = request.query_params.get('status')
        payment_method = request.query_params.get('payment_method')
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        if status_filter:
            orders = orders.filter(status=status_filter)
        if payment_method:
            orders = orders.filter(payment_method=payment_method)
        if from_date:
            orders = orders.filter(created_at__date__gte=from_date)
        if to_date:
            orders = orders.filter(created_at__date__lte=to_date)
        return Response(OrderDetailSerializer(orders[:200], many=True).data)


class AdminOrderDetailAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, order_id):
        order = Order.objects.filter(order_id=order_id).prefetch_related('items', 'items__product', 'status_histories').first()
        if order is None:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrderDetailSerializer(order).data)


class AdminOrderStatusAPIView(StaffOrderStatusAPIView):
    permission_classes = [IsAdmin]

    def put(self, request, order_id):
        order = Order.objects.filter(order_id=order_id).first()
        if order is None:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        if order.status == 'delivered' and not order.return_requests.exists():
            return Response({'detail': 'Admin chi can thiep don delivered khi co khieu nai/doi tra'}, status=status.HTTP_400_BAD_REQUEST)
        return super().put(request, order_id)


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


class AdminUserUpdateDeleteAPIView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
    def put(self, request, user_id):
        user = StoreUser.objects.select_for_update().filter(user_id=user_id).first()
        if user is None:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        serializer = AdminUserUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = serializer.validated_data
        email = values.get('email')
        if email and StoreUser.objects.exclude(user_id=user_id).filter(email=email).exists():
            return Response({'detail': 'Email da duoc su dung'}, status=status.HTTP_400_BAD_REQUEST)
        full_name = values.pop('full_name', None)
        for field, value in values.items():
            setattr(user, field, value)
        user.save(update_fields=[*values.keys(), 'updated_at'])
        if full_name is not None and hasattr(user, 'customer_profile'):
            user.customer_profile.full_name = full_name.strip()
            user.customer_profile.save(update_fields=['full_name', 'updated_at'])
        audit(request, 'update_user', 'user', user_id, {'fields': [*values.keys(), *(['full_name'] if full_name is not None else [])]})
        return Response(AdminUserSerializer(user).data)

    @transaction.atomic
    def delete(self, request, user_id):
        if request.user.user_id == user_id:
            return Response({'detail': 'Admin khong duoc tu xoa tai khoan dang dang nhap'}, status=status.HTTP_400_BAD_REQUEST)
        user = StoreUser.objects.select_for_update().filter(user_id=user_id).first()
        if user is None:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        previous_status = user.account_status
        user.account_status = 'inactive'
        user.locked_until = None
        user.save(update_fields=['account_status', 'locked_until', 'updated_at'])
        audit(
            request,
            'delete_user',
            'user',
            user_id,
            {'account_status': 'inactive'},
            {'account_status': previous_status},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


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
    defaults = [
        {'method_id': 1, 'code': 'cod', 'name': 'Thanh toan khi nhan hang', 'is_active': True, 'config': {}, 'source': 'payments.method'},
        {'method_id': 2, 'code': 'vnpay', 'name': 'VNPay', 'is_active': True, 'config': {}, 'source': 'payments.method'},
        {'method_id': 3, 'code': 'momo', 'name': 'MoMo', 'is_active': True, 'config': {}, 'source': 'payments.method'},
        {'method_id': 4, 'code': 'bank_transfer', 'name': 'Chuyen khoan ngan hang', 'is_active': True, 'config': {}, 'source': 'payments.method'},
    ]

    def get_queryset(self):
        if not table_exists('payment_methods'):
            return PaymentMethod.objects.none()
        for item in self.defaults:
            PaymentMethod.objects.get_or_create(
                code=item['code'],
                defaults={'name': item['name'], 'is_active': item['is_active'], 'config': item['config']},
            )
        return super().get_queryset()

    def list(self, request, *args, **kwargs):
        if not table_exists('payment_methods'):
            usage = {
                row['payment_method']: row['count']
                for row in Payment.objects.values('payment_method').annotate(count=models.Count('payment_id'))
            }
            rows = [{**item, 'usage_count': usage.get(item['code'], 0)} for item in self.defaults]
            return Response(rows)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if not table_exists('payment_methods'):
            return Response({'detail': 'DB hien tai dang luu phuong thuc thanh toan trong payments.method. Can migration payment_methods rieng neu muon bat/tat hoac luu config.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not table_exists('payment_methods'):
            return Response({'detail': 'DB hien tai dang luu phuong thuc thanh toan trong payments.method. Can migration payment_methods rieng neu muon bat/tat hoac luu config.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def perform_create(self, serializer):
        item = serializer.save()
        audit(self.request, 'create_payment_method', 'payment_method', item.method_id)

    def perform_update(self, serializer):
        item = serializer.save()
        audit(self.request, 'update_payment_method', 'payment_method', item.method_id)


class RecommendationConfigViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdmin]
    serializer_class = RecommendationConfigSerializer
    queryset = RecommendationConfig.objects.all().order_by('config_key')

    def get_queryset(self):
        if not table_exists('recommendation_configs'):
            return RecommendationConfig.objects.none()
        return super().get_queryset()

    def list(self, request, *args, **kwargs):
        if not table_exists('recommendation_configs'):
            return Response([])
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        if not table_exists('recommendation_configs'):
            return Response({'detail': 'DB hien tai chua co bang recommendation_configs. Can migration neu muon luu cau hinh AI.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not table_exists('recommendation_configs'):
            return Response({'detail': 'DB hien tai chua co bang recommendation_configs. Can migration neu muon luu cau hinh AI.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

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


class RunRecommendationAPIView(APIView):
    permission_classes = [IsAdmin]

    @transaction.atomic
    def post(self, request):
        top_n = max(1, min(int(request.data.get('top_n', 10)), 100))
        cold_start_threshold = max(1, min(int(request.data.get('cold_start_threshold', 5)), 100))
        result = run_recommendation_batch(top_n=top_n, cold_start_threshold=cold_start_threshold)
        count = int(result.get('generated', 0))
        audit(request, 'run_recommendations', 'recommendation_job', metadata={'count': count, 'top_n': top_n, 'cold_start_threshold': cold_start_threshold})
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


class ReportsOrderStatusAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        orders = Order.objects.all()
        from_date = request.query_params.get('from_date')
        to_date = request.query_params.get('to_date')
        if from_date:
            orders = orders.filter(created_at__date__gte=from_date)
        if to_date:
            orders = orders.filter(created_at__date__lte=to_date)
        rows = orders.values('status').annotate(count=models.Count('order_id'), total_amount=models.Sum('final_amount')).order_by('status')
        return Response(list(rows))


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
        if event_type == 'click':
            customer = Customer.objects.filter(user=request.user).first()
            item = RecommendationLog.objects.filter(user=customer, product=product, clicked=False).order_by('-shown_at').first()
            if item:
                item.clicked = True
                item.clicked_at = timezone.now()
                item.save(update_fields=['clicked', 'clicked_at'])
            else:
                RecommendationLog.objects.create(user=customer, product=product, clicked=True, clicked_at=timezone.now())
        else:
            customer = Customer.objects.filter(user=request.user).first()
            recommendation = PrecomputedRecommendation.objects.filter(user=customer, product=product, expires_at__gt=timezone.now()).order_by('-generated_at').first()
            RecommendationLog.objects.create(user=customer, product=product, recommendation=recommendation)
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
