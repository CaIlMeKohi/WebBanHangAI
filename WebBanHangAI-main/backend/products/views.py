from datetime import timedelta
import secrets

from django.contrib.auth.hashers import check_password, make_password
from django.db import DatabaseError, models, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .application.cart_service import get_customer_cart_items, get_or_create_cart
from .application.catalog_queries import active_products_queryset, apply_catalog_filters
from .application.customer_context import get_active_user, get_customer_for_user
from .infrastructure.stored_procedures import adjust_variant_stock, check_variant_stock, decrease_variant_stock, hard_delete_product, low_stock_variants
from .security.authentication import create_access_token
from .services.email_service import send_order_confirmation, send_verification_email
from .models import Address, Brand, Cart, CartItem, Coupon, Customer, EmailVerificationToken, LoginLog, Order, OrderItem, Payment, Product, ProductVariant, Category, RecommendationLog, SearchLog, StoreUser, UserInteraction, WishlistItem
from .security.permissions import IsAdmin, IsStaff
from .serializers import (
    AddressSerializer,
    AuthSerializer,
    BrandSerializer,
    CartItemSerializer,
    CategorySerializer,
    CouponSerializer,
    OrderSerializer,
    ProductSerializer,
    UserProductEventSerializer,
    ProductAdminSerializer,
    ProductVariantSerializer,
    RegisterSerializer,
    StoreUserSerializer,
    WishlistItemSerializer,
)


class ProductPagination(PageNumberPagination):
    page_size = 32
    page_size_query_param = 'page_size'
    max_page_size = 100


class ProductListAPIView(generics.ListAPIView):
    serializer_class = ProductSerializer
    pagination_class = ProductPagination

    def get_queryset(self):
        queryset = active_products_queryset()
        search = self.request.query_params.get('search')
        queryset = apply_catalog_filters(queryset, self.request.query_params)
        if search:
            user = _get_user(self.request)
            try:
                SearchLog.objects.create(
                    user=user,
                    session_id=self.request.query_params.get('session_id'),
                    query=search[:255],
                )
            except DatabaseError:
                pass
            first_product = queryset.first()
            if user and first_product:
                try:
                    UserInteraction.objects.create(user=_get_customer(user), product=first_product, interaction_type='search', search_query=search[:255], score=0.5)
                except DatabaseError:
                    pass
        return queryset


class ProductDetailAPIView(generics.RetrieveAPIView):
    queryset = Product.objects.filter(status='active').select_related('category', 'brand').prefetch_related('images', 'variants', 'category__children')
    serializer_class = ProductSerializer
    lookup_field = 'product_id'
    lookup_url_kwarg = 'id'

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        user = _get_user(request)
        if user:
            try:
                UserInteraction.objects.create(user=_get_customer(user), product=self.get_object(), interaction_type='view', score=1.0)
            except DatabaseError:
                pass
        return response


class ProductAdminListCreateAPIView(generics.ListCreateAPIView):
    """Admin: List all products (including inactive) and create new ones"""
    queryset = Product.objects.all().select_related('category', 'brand').prefetch_related('images', 'variants')
    serializer_class = ProductAdminSerializer
    permission_classes = [IsAdmin]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def perform_create(self, serializer):
        serializer.save()


class ProductAdminUpdateDeleteAPIView(generics.RetrieveUpdateDestroyAPIView):
    """Admin: Update or delete a specific product"""
    queryset = Product.objects.all()
    serializer_class = ProductAdminSerializer
    lookup_field = 'product_id'
    lookup_url_kwarg = 'id'
    permission_classes = [IsAdmin]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        result = hard_delete_product(product.product_id)
        if not result.get('deleted'):
            return Response(
                {'detail': result.get('reason') or 'Khong the xoa san pham.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserEventCreateAPIView(generics.CreateAPIView):
    queryset = UserInteraction.objects.all()
    serializer_class = UserProductEventSerializer

    def perform_create(self, serializer):
        interaction_type = serializer.validated_data.get('interaction_type')
        user_id = serializer.validated_data.get('user_id')
        if interaction_type in {'add_to_cart', 'wishlist_add', 'purchase'} and not user_id:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({'user_id': 'Dang nhap de ghi nhan hanh vi nay.'})
        serializer.save()


class CategoryListAPIView(generics.ListAPIView):
    serializer_class = CategorySerializer

    def get_queryset(self):
        return Category.objects.filter(parent__isnull=True).prefetch_related('children', 'children__products').order_by('name')


class AuthLoginAPIView(APIView):
    def post(self, request):
        serializer = AuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data['username'].strip().lower()
        password = serializer.validated_data['password']
        user = StoreUser.objects.filter(Q(email=username) | Q(phone=username)).first()

        if not user or not user.is_active:
            LoginLog.objects.create(user=user, identifier=username, success=False, ip_address=request.META.get('REMOTE_ADDR', ''), reason='inactive_or_missing')
            return Response({'detail': 'Tai khoan khong hop le hoac da bi khoa'}, status=status.HTTP_400_BAD_REQUEST)
        if not check_password(password, user.password_hash):
            LoginLog.objects.create(user=user, identifier=username, success=False, ip_address=request.META.get('REMOTE_ADDR', ''), reason='bad_password')
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_400_BAD_REQUEST)

        LoginLog.objects.create(user=user, identifier=username, success=True, ip_address=request.META.get('REMOTE_ADDR', ''))
        return Response({'user': StoreUserSerializer(user).data, 'access': create_access_token(user), 'expires_in_hours': 8 if user.role in {'staff', 'admin'} else 24})


class AuthRegisterAPIView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        username = serializer.validated_data['username'].strip().lower()
        password = serializer.validated_data['password']
        email = username
        phone = serializer.validated_data.get('phone', '').strip()

        if StoreUser.objects.filter(email=email).exists():
            return Response({'detail': 'User already exists'}, status=status.HTTP_400_BAD_REQUEST)
        if phone and StoreUser.objects.filter(phone=phone).exists():
            return Response({'detail': 'Phone already exists'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = StoreUser.objects.create(
                email=email,
                phone=phone or None,
                password_hash=make_password(password),
                role='customer',
                account_status='active',
                email_verified_at=timezone.now(),
            )
            Customer.objects.create(
                user=user,
                customer_code=f'KH{user.user_id:06d}',
                full_name=serializer.validated_data['full_name'],
                gender=serializer.validated_data.get('gender', 'unknown'),
                birthday=serializer.validated_data.get('birthday'),
            )
            customer = user.customer_profile
            address_line = str(request.data.get('address_line', '')).strip()
            ward = str(request.data.get('ward', '')).strip()
            district = str(request.data.get('district', '')).strip()
            province = str(request.data.get('province', '')).strip()
            if address_line and ward and district and province:
                Address.objects.create(
                    user=customer,
                    full_name=serializer.validated_data['full_name'],
                    phone=phone or '',
                    address_line=address_line,
                    ward=ward,
                    district=district,
                    province=province,
                    is_default=True,
                )
            token = secrets.token_urlsafe(48)
            EmailVerificationToken.objects.create(user=user, token=token, expires_at=timezone.now() + timedelta(hours=24))
        email_result = send_verification_email(user.email, token)
        payload = {'user': StoreUserSerializer(user).data, 'access': create_access_token(user)}
        if email_result.get('skipped'):
            payload['dev_verification_token'] = token
        return Response(payload, status=status.HTTP_201_CREATED)


def _get_user(request):
    if getattr(getattr(request, 'user', None), 'user_id', None):
        return request.user
    user_id = request.query_params.get('user_id') or request.data.get('user_id')
    if not user_id:
        return None
    return get_active_user(user_id)


def _get_customer(user):
    return get_customer_for_user(user)


def _available_stock(product, variant=None):
    if variant is not None:
        stock = check_variant_stock(variant.variant_id, 1)
        if stock is not None and 'available_stock' in stock:
            return max(0, int(stock['available_stock']))
        return max(0, variant.stock_quantity - variant.stock_reserved)
    return sum(max(0, item.stock_quantity - item.stock_reserved) for item in product.variants.all())


def _variant_label(variant):
    if variant is None:
        return 'mac dinh'
    size = variant.size or 'STD'
    color = variant.color or 'Mac dinh'
    return f'{size}/{color}'


class ProfileAPIView(APIView):
    def get(self, request):
        user = _get_user(request)
        if not user:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(StoreUserSerializer(user).data)

    def put(self, request):
        user = _get_user(request)
        if not user:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        user.phone = request.data.get('phone', user.phone)
        user.save(update_fields=['phone'])
        profile, _ = Customer.objects.get_or_create(
            user=user,
            defaults={'customer_code': f'KH{user.user_id:06d}', 'full_name': user.email},
        )
        profile.full_name = request.data.get('full_name', profile.full_name)
        profile.gender = request.data.get('gender', profile.gender)
        profile.birthday = request.data.get('birthday', profile.birthday)
        profile.preferred_size = request.data.get('preferred_size', profile.preferred_size)
        profile.preferred_color = request.data.get('preferred_color', profile.preferred_color)
        profile.preferred_style = request.data.get('preferred_style', profile.preferred_style)
        profile.save(update_fields=['full_name', 'gender', 'birthday', 'preferred_size', 'preferred_color', 'preferred_style'])
        return Response(StoreUserSerializer(user).data)


class AddressListCreateAPIView(APIView):
    def get(self, request):
        user = _get_user(request)
        customer = _get_customer(user)
        if not customer:
            return Response([])
        addresses = Address.objects.filter(user=customer).order_by('-is_default', '-created_at')
        return Response(AddressSerializer(addresses, many=True).data)

    def post(self, request):
        user = _get_user(request)
        customer = _get_customer(user)
        if not customer:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        if Address.objects.filter(user=customer).count() >= 5:
            return Response({'detail': 'Moi khach hang chi duoc luu toi da 5 dia chi'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AddressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        should_default = serializer.validated_data.get('is_default') or not Address.objects.filter(user=customer).exists()

        with transaction.atomic():
            if should_default:
                Address.objects.filter(user=customer, is_default=True).update(is_default=False)
            address = serializer.save(user=customer, is_default=should_default)

        return Response(AddressSerializer(address).data, status=status.HTTP_201_CREATED)


class AddressDetailAPIView(APIView):
    def put(self, request, address_id):
        user = _get_user(request)
        customer = _get_customer(user)
        address = Address.objects.filter(address_id=address_id, user=customer).first()
        if address is None:
            return Response({'detail': 'Address not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AddressSerializer(address, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        should_default = serializer.validated_data.get('is_default')

        with transaction.atomic():
            if should_default:
                Address.objects.filter(user=customer, is_default=True).exclude(address_id=address_id).update(is_default=False)
            address = serializer.save()

        return Response(AddressSerializer(address).data)

    def delete(self, request, address_id):
        user = _get_user(request)
        customer = _get_customer(user)
        address = Address.objects.filter(address_id=address_id, user=customer).first()
        if address is None:
            return Response({'detail': 'Address not found'}, status=status.HTTP_404_NOT_FOUND)
        was_default = address.is_default
        address.delete()
        if was_default:
            next_address = Address.objects.filter(user=customer).order_by('-created_at').first()
            if next_address:
                next_address.is_default = True
                next_address.save(update_fields=['is_default'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class CartAPIView(APIView):
    def get(self, request):
        user = _get_user(request)
        customer = _get_customer(user)
        if not customer:
            return Response([])
        items = get_customer_cart_items(customer)
        return Response(CartItemSerializer(items, many=True).data)

    def post(self, request):
        user = _get_user(request)
        customer = _get_customer(user)
        if not customer:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        product = Product.objects.filter(product_id=request.data.get('product_id'), status='active').first()
        if product is None:
            return Response({'detail': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
        variant = None
        size = request.data.get('size')
        color = request.data.get('color')
        variants = product.variants.filter(is_active=True)
        requested_variant_id = request.data.get('variant_id')
        if requested_variant_id:
            variant = variants.filter(variant_id=requested_variant_id).first()
        if variant is None:
            for candidate in variants:
                if (not size or candidate.size == size) and (not color or candidate.color == color):
                    variant = candidate
                    break
        if variant is None:
            variant = variants.first()
        if variant is None:
            return Response({'detail': 'San pham chua co SKU hop le'}, status=status.HTTP_400_BAD_REQUEST)

        quantity = max(1, int(request.data.get('quantity', 1)))
        if _available_stock(product, variant) < quantity:
            return Response({'detail': f'Khong du ton kho cho bien the {_variant_label(variant)}'}, status=status.HTTP_400_BAD_REQUEST)

        cart = get_or_create_cart(customer)
        item, created = CartItem.objects.get_or_create(
            cart=cart,
            variant=variant,
            defaults={'quantity': quantity},
        )
        if not created:
            if _available_stock(product, variant) < item.quantity + quantity:
                return Response({'detail': f'Khong du ton kho cho bien the {_variant_label(variant)}'}, status=status.HTTP_400_BAD_REQUEST)
            item.quantity += quantity
            item.save(update_fields=['quantity'])

        UserInteraction.objects.create(user=customer, product=product, interaction_type='add_to_cart', score=3.0)
        return Response(CartItemSerializer(item).data, status=status.HTTP_201_CREATED)


class CartItemAPIView(APIView):
    def put(self, request, item_id):
        user = _get_user(request)
        customer = _get_customer(user)
        item = CartItem.objects.filter(cart_item_id=item_id, cart__customer=customer).select_related('variant', 'variant__product').first()
        if not item:
            return Response({'detail': 'Cart item not found'}, status=status.HTTP_404_NOT_FOUND)
        next_quantity = max(1, int(request.data.get('quantity', item.quantity)))
        if _available_stock(item.product, item.variant) < next_quantity:
            return Response({'detail': f'Khong du ton kho cho bien the {_variant_label(item.variant)}'}, status=status.HTTP_400_BAD_REQUEST)
        item.quantity = next_quantity
        item.save(update_fields=['quantity'])
        return Response(CartItemSerializer(item).data)

    def delete(self, request, item_id):
        user = _get_user(request)
        customer = _get_customer(user)
        CartItem.objects.filter(cart_item_id=item_id, cart__customer=customer).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WishlistAPIView(APIView):
    def get(self, request):
        user = _get_user(request)
        if not user:
            return Response([])
        customer = _get_customer(user)
        if not customer:
            return Response([])
        items = WishlistItem.objects.filter(user=customer).select_related('product', 'product__category', 'product__brand').prefetch_related('product__images', 'product__variants')
        return Response(WishlistItemSerializer(items, many=True).data)

    def post(self, request):
        user = _get_user(request)
        if not user:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        customer = _get_customer(user)
        if not customer:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        if WishlistItem.objects.filter(user=customer).count() >= 100:
            return Response({'detail': 'Danh sach yeu thich toi da 100 san pham'}, status=status.HTTP_400_BAD_REQUEST)
        product = Product.objects.filter(product_id=request.data.get('product_id'), status='active').first()
        if product is None:
            return Response({'detail': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
        item, created = WishlistItem.objects.get_or_create(user=customer, product=product)
        if created:
            UserInteraction.objects.create(user=customer, product=product, interaction_type='wishlist_add', score=2.5)
        return Response(WishlistItemSerializer(item).data, status=status.HTTP_201_CREATED)


class OrderListCreateAPIView(APIView):
    def get(self, request):
        user = _get_user(request)
        customer = _get_customer(user)
        if not customer:
            return Response([])
        orders = Order.objects.filter(user=customer).prefetch_related('items', 'items__product', 'items__product__images', 'items__product__variants').order_by('-created_at')
        return Response(OrderSerializer(orders, many=True).data)

    @transaction.atomic
    def post(self, request):
        user = _get_user(request)
        customer = _get_customer(user)
        if not customer:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        selected_ids = request.data.get('cart_item_ids') or []
        cart_queryset = get_customer_cart_items(customer)
        if selected_ids:
            cart_queryset = cart_queryset.filter(cart_item_id__in=selected_ids)
        cart_items = list(cart_queryset)
        if not cart_items:
            return Response({'detail': 'Cart is empty'}, status=status.HTTP_400_BAD_REQUEST)

        address = Address.objects.filter(user=customer, is_default=True).first()
        if address is None:
            return Response({'detail': 'Vui long cap nhat dia chi giao hang mac dinh truoc khi dat hang'}, status=status.HTTP_400_BAD_REQUEST)

        for item in cart_items:
            if _available_stock(item.product, item.variant) < item.quantity:
                return Response({'detail': f'San pham {item.product.name} khong du ton kho'}, status=status.HTTP_400_BAD_REQUEST)

        subtotal = sum(int(item.variant.price if item.variant_id else item.product.base_price) * item.quantity for item in cart_items)
        shipping_fee = 0 if subtotal > 1_000_000 else 30_000
        order = Order.objects.create(
            user=customer,
            address=address,
            order_code=f'ORD{timezone.now().strftime("%Y%m%d%H%M%S")}{customer.customer_id}',
            receiver_name_snapshot=address.full_name,
            receiver_phone_snapshot=address.phone,
            address_line_snapshot=address.address_line,
            ward_snapshot=address.ward,
            district_snapshot=address.district,
            province_snapshot=address.province,
            postal_code_snapshot=address.postal_code,
            total_amount=subtotal,
            shipping_fee=shipping_fee,
            discount_amount=0,
            final_amount=subtotal + shipping_fee,
            payment_method=request.data.get('payment_method', 'cod'),
        )
        for item in cart_items:
            price = int(item.variant.price if item.variant_id else item.product.base_price)
            OrderItem.objects.create(
                order=order,
                product=item.product,
                variant=item.variant,
                product_name_snapshot=item.product.name,
                brand_name_snapshot=item.product.brand.name,
                category_name_snapshot=item.product.category.name,
                sku_snapshot=item.variant.sku,
                color_snapshot=item.variant.color,
                size_snapshot=item.variant.size,
                quantity=item.quantity,
                price=price,
                subtotal=price * item.quantity,
            )
            if item.variant_id:
                if not decrease_variant_stock(item.variant.variant_id, item.quantity, order.order_id):
                    return Response({'detail': f'San pham {item.product.name} khong du ton kho'}, status=status.HTTP_400_BAD_REQUEST)
            UserInteraction.objects.create(user=customer, product=item.product, interaction_type='purchase', score=5.0)
            RecommendationLog.objects.filter(user=customer, product=item.product, clicked=True, converted_order__isnull=True).update(
                ordered_after_click=True,
                converted_order=order,
            )

        Payment.objects.create(order=order, amount=order.final_amount, payment_method=order.payment_method, status='pending')
        CartItem.objects.filter(cart_item_id__in=[item.cart_item_id for item in cart_items], cart__customer=customer).delete()
        send_order_confirmation(user.email, order.order_id, order.final_amount)
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class BrandListAPIView(generics.ListAPIView):
    serializer_class = BrandSerializer

    def get_queryset(self):
        return Brand.objects.filter(is_active=True).order_by('name')


class AdminCategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    permission_classes = [IsAdmin]

    def destroy(self, request, *args, **kwargs):
        category = self.get_object()
        if Product.objects.filter(Q(category=category) | Q(category__parent=category)).exists():
            category.is_active = False
            category.save(update_fields=['is_active'])
            return Response(CategorySerializer(category).data)
        return super().destroy(request, *args, **kwargs)


class AdminBrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.all().order_by('name')
    serializer_class = BrandSerializer
    permission_classes = [IsAdmin]


class AdminVariantViewSet(viewsets.ModelViewSet):
    queryset = ProductVariant.objects.select_related('product').all().order_by('sku')
    serializer_class = ProductVariantSerializer
    permission_classes = [IsAdmin]


class AdminCouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.all().order_by('-created_at')
    serializer_class = CouponSerializer
    permission_classes = [IsAdmin]


class CartClearAPIView(APIView):
    def delete(self, request):
        user = _get_user(request)
        customer = _get_customer(user)
        if not customer:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        CartItem.objects.filter(cart__customer=customer).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ApplyCouponAPIView(APIView):
    def post(self, request):
        user = _get_user(request)
        customer = _get_customer(user)
        if not customer:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        code = str(request.data.get('code', '')).strip().upper()
        coupon = Coupon.objects.filter(code__iexact=code, is_active=True).first()
        if coupon is None:
            return Response({'detail': 'Coupon khong hop le'}, status=status.HTTP_400_BAD_REQUEST)
        if coupon.expiry_date and coupon.expiry_date < timezone.localdate():
            return Response({'detail': 'Coupon da het han'}, status=status.HTTP_400_BAD_REQUEST)
        if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
            return Response({'detail': 'Coupon da het luot su dung'}, status=status.HTTP_400_BAD_REQUEST)

        cart_items = get_customer_cart_items(customer)
        subtotal = sum(int(item.variant.price if item.variant_id else item.product.base_price) * item.quantity for item in cart_items)
        if subtotal < coupon.min_order_amount:
            return Response({'detail': 'Don hang chua dat gia tri toi thieu'}, status=status.HTTP_400_BAD_REQUEST)

        if coupon.discount_type == 'percentage':
            discount = subtotal * coupon.discount_value // 100
            if coupon.max_discount:
                discount = min(discount, coupon.max_discount)
        else:
            discount = coupon.discount_value
        discount = min(discount, subtotal)
        return Response({'coupon': CouponSerializer(coupon).data, 'subtotal': subtotal, 'discount_amount': discount, 'final_amount': max(0, subtotal - discount)})


class OrderDetailAPIView(APIView):
    def get(self, request, order_id):
        user = _get_user(request)
        customer = _get_customer(user)
        order = Order.objects.filter(order_id=order_id, user=customer).prefetch_related('items', 'items__product', 'items__product__images', 'items__product__variants').first()
        if order is None:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrderSerializer(order).data)


class OrderCancelAPIView(APIView):
    @transaction.atomic
    def post(self, request, order_id):
        user = _get_user(request)
        customer = _get_customer(user)
        order = Order.objects.filter(order_id=order_id, user=customer).first()
        if order is None:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        if order.status not in {'pending', 'confirmed', 'processing'}:
            return Response({'detail': 'Khong the huy don o trang thai hien tai'}, status=status.HTTP_400_BAD_REQUEST)
        order.status = 'cancelled'
        order.save(update_fields=['status', 'updated_at'])
        return Response(OrderSerializer(order).data)


class StaffOrderListAPIView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        orders = Order.objects.filter(status__in=['pending', 'confirmed', 'processing']).order_by('-created_at')
        status_param = request.query_params.get('status')
        payment_method = request.query_params.get('payment_method')
        if status_param:
            orders = orders.filter(status=status_param)
        if payment_method:
            orders = orders.filter(payment_method=payment_method)
        return Response(OrderSerializer(orders.prefetch_related('items', 'items__product'), many=True).data)


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
        order = Order.objects.filter(order_id=order_id).first()
        if order is None:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        next_status = request.data.get('status')
        if next_status not in self.transitions.get(order.status, set()):
            return Response({'detail': 'Chuyen trang thai khong hop le'}, status=status.HTTP_400_BAD_REQUEST)
        if next_status == 'shipped' and (not request.data.get('carrier_name') or not request.data.get('tracking_code')):
            return Response({'detail': 'Can nhap don vi van chuyen va ma van don khi shipped'}, status=status.HTTP_400_BAD_REQUEST)
        order.status = next_status
        order.save(update_fields=['status', 'updated_at'])
        return Response(OrderSerializer(order).data)


class InventoryAdjustAPIView(APIView):
    permission_classes = [IsStaff]

    @transaction.atomic
    def post(self, request):
        variant = ProductVariant.objects.filter(variant_id=request.data.get('variant_id')).first()
        if variant is None:
            return Response({'detail': 'Variant not found'}, status=status.HTTP_404_NOT_FOUND)
        try:
            change = int(request.data.get('change_quantity'))
        except (TypeError, ValueError):
            return Response({'detail': 'change_quantity khong hop le'}, status=status.HTTP_400_BAD_REQUEST)
        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            return Response({'detail': 'Bat buoc nhap ly do dieu chinh kho'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            adjust_variant_stock(
                variant_id=variant.variant_id,
                change_quantity=change,
                staff_user_id=request.user.user_id,
                action_type='import' if change > 0 else 'adjust',
                reason=reason[:500],
            )
        except DatabaseError:
            return Response({'detail': 'Khong the dieu chinh kho. Vui long kiem tra so luong va thu lai.'}, status=status.HTTP_400_BAD_REQUEST)
        variant.refresh_from_db()
        return Response(ProductVariantSerializer(variant).data)


class LowStockAPIView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        return Response(low_stock_variants())
