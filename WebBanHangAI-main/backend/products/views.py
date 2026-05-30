from datetime import timedelta
import secrets

from django.contrib.auth.hashers import check_password, make_password
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .security.authentication import create_access_token
from .services.email_service import send_order_confirmation, send_verification_email
from .models import Address, Brand, CartItem, Coupon, Customer, EmailVerificationToken, InventoryLog, LoginLog, Order, OrderItem, Payment, Product, ProductVariant, Category, SearchLog, StoreUser, UserInteraction, WishlistItem
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
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 50


class ProductListAPIView(generics.ListAPIView):
    serializer_class = ProductSerializer
    pagination_class = ProductPagination

    def get_queryset(self):
        queryset = Product.objects.filter(status='active').select_related('category', 'brand').prefetch_related('images', 'variants', 'category__children', 'interactions')

        category = self.request.query_params.get('category')
        is_new = self.request.query_params.get('new')
        is_sale = self.request.query_params.get('sale')
        search = self.request.query_params.get('search')
        subcategories = self.request.query_params.getlist('subcategory')
        brand = self.request.query_params.get('brand')
        size = self.request.query_params.get('size')
        color = self.request.query_params.get('color')
        rating = self.request.query_params.get('rating')
        in_stock = self.request.query_params.get('in_stock')

        if category:
            queryset = queryset.filter(Q(category__slug=category) | Q(category__parent__slug=category))
        if is_new in {'true', '1'}:
            queryset = queryset.filter(is_new=True)
        if is_sale in {'true', '1'}:
            queryset = queryset.none()
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(description__icontains=search) | Q(feature_text__icontains=search) | Q(brand__name__icontains=search))
            user = _get_user(self.request)
            SearchLog.objects.create(
                user=user,
                session_id=self.request.query_params.get('session_id'),
                query=search[:255],
            )
            first_product = queryset.first()
            if user and first_product:
                UserInteraction.objects.create(user=user, product=first_product, interaction_type='search', search_query=search[:255], score=0.5)
        if subcategories:
            queryset = queryset.filter(category__slug__in=subcategories)
        if brand:
            queryset = queryset.filter(Q(brand__slug=brand) | Q(brand_id=brand))
        if size:
            queryset = queryset.filter(variants__size=size, variants__is_active=True)
        if color:
            queryset = queryset.filter(variants__color=color, variants__is_active=True)
        if rating:
            queryset = queryset.filter(average_rating__gte=rating)
        if in_stock in {'true', '1'}:
            queryset = queryset.filter(variants__stock_quantity__gt=0)

        min_price = self.request.query_params.get('minPrice')
        max_price = self.request.query_params.get('maxPrice')
        sort = self.request.query_params.get('sort')

        if min_price:
            queryset = queryset.filter(base_price__gte=min_price)
        if max_price:
            queryset = queryset.filter(base_price__lte=max_price)
        if sort == 'price_asc':
            queryset = queryset.order_by('base_price')
        elif sort == 'price_desc':
            queryset = queryset.order_by('-base_price')
        elif sort == 'newest':
            queryset = queryset.order_by('-created_at')

        return queryset.distinct()


class ProductDetailAPIView(generics.RetrieveAPIView):
    queryset = Product.objects.filter(status='active').select_related('category', 'brand').prefetch_related('images', 'variants', 'category__children', 'interactions')
    serializer_class = ProductSerializer
    lookup_field = 'product_id'
    lookup_url_kwarg = 'id'

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        user = _get_user(request)
        if user:
            UserInteraction.objects.create(user=user, product=self.get_object(), interaction_type='view', score=1.0)
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

        if not user or user.account_status != 'active':
            LoginLog.objects.create(user=user, identifier=username, success=False, ip_address=request.META.get('REMOTE_ADDR', ''), reason='inactive_or_missing')
            return Response({'detail': 'Tai khoan khong hop le hoac da bi khoa'}, status=status.HTTP_400_BAD_REQUEST)
        if user.locked_until and user.locked_until > timezone.now():
            LoginLog.objects.create(user=user, identifier=username, success=False, ip_address=request.META.get('REMOTE_ADDR', ''), reason='temporarily_locked')
            return Response({'detail': 'Tai khoan dang bi khoa tam thoi. Vui long thu lai sau.'}, status=status.HTTP_423_LOCKED)
        if not check_password(password, user.password_hash):
            user.failed_login_count += 1
            update_fields = ['failed_login_count']
            if user.failed_login_count >= 5:
                user.locked_until = timezone.now() + timedelta(minutes=30)
                update_fields.append('locked_until')
            user.save(update_fields=update_fields)
            LoginLog.objects.create(user=user, identifier=username, success=False, ip_address=request.META.get('REMOTE_ADDR', ''), reason='bad_password')
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_400_BAD_REQUEST)

        user.last_login_at = timezone.now()
        user.failed_login_count = 0
        user.locked_until = None
        user.save(update_fields=['last_login_at', 'failed_login_count', 'locked_until'])
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
            address_line = str(request.data.get('address_line', '')).strip()
            ward = str(request.data.get('ward', '')).strip()
            district = str(request.data.get('district', '')).strip()
            province = str(request.data.get('province', '')).strip()
            if address_line and ward and district and province:
                Address.objects.create(
                    user=user,
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
    return StoreUser.objects.filter(user_id=user_id, account_status='active').first()


def _available_stock(product, variant=None):
    if variant is not None:
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
        if not user:
            return Response([])
        addresses = Address.objects.filter(user=user).order_by('-is_default', '-created_at')
        return Response(AddressSerializer(addresses, many=True).data)

    def post(self, request):
        user = _get_user(request)
        if not user:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        if Address.objects.filter(user=user).count() >= 5:
            return Response({'detail': 'Moi khach hang chi duoc luu toi da 5 dia chi'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = AddressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        should_default = serializer.validated_data.get('is_default') or not Address.objects.filter(user=user).exists()

        with transaction.atomic():
            if should_default:
                Address.objects.filter(user=user, is_default=True).update(is_default=False)
            address = serializer.save(user=user, is_default=should_default)

        return Response(AddressSerializer(address).data, status=status.HTTP_201_CREATED)


class AddressDetailAPIView(APIView):
    def put(self, request, address_id):
        user = _get_user(request)
        address = Address.objects.filter(address_id=address_id, user=user).first()
        if address is None:
            return Response({'detail': 'Address not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = AddressSerializer(address, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        should_default = serializer.validated_data.get('is_default')

        with transaction.atomic():
            if should_default:
                Address.objects.filter(user=user, is_default=True).exclude(address_id=address_id).update(is_default=False)
            address = serializer.save()

        return Response(AddressSerializer(address).data)

    def delete(self, request, address_id):
        user = _get_user(request)
        address = Address.objects.filter(address_id=address_id, user=user).first()
        if address is None:
            return Response({'detail': 'Address not found'}, status=status.HTTP_404_NOT_FOUND)
        was_default = address.is_default
        address.delete()
        if was_default:
            next_address = Address.objects.filter(user=user).order_by('-created_at').first()
            if next_address:
                next_address.is_default = True
                next_address.save(update_fields=['is_default'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class CartAPIView(APIView):
    def get(self, request):
        user = _get_user(request)
        if not user:
            return Response([])
        items = CartItem.objects.filter(user=user).select_related('product', 'variant', 'product__category', 'product__brand').prefetch_related('product__images', 'product__variants')
        return Response(CartItemSerializer(items, many=True).data)

    def post(self, request):
        user = _get_user(request)
        if not user:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        product = Product.objects.filter(product_id=request.data.get('product_id'), status='active').first()
        if product is None:
            return Response({'detail': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
        variant = None
        size = request.data.get('size')
        color = request.data.get('color')
        if size or color:
            variants = product.variants.all()
            for candidate in variants:
                if (not size or candidate.size == size) and (not color or candidate.color == color):
                    variant = candidate
                    break

        quantity = max(1, int(request.data.get('quantity', 1)))
        if _available_stock(product, variant) < quantity:
            return Response({'detail': f'Khong du ton kho cho bien the {_variant_label(variant)}'}, status=status.HTTP_400_BAD_REQUEST)

        item, created = CartItem.objects.get_or_create(
            user=user,
            product=product,
            variant=variant,
            defaults={'quantity': quantity},
        )
        if not created:
            if _available_stock(product, variant) < item.quantity + quantity:
                return Response({'detail': f'Khong du ton kho cho bien the {_variant_label(variant)}'}, status=status.HTTP_400_BAD_REQUEST)
            item.quantity += quantity
            item.save(update_fields=['quantity'])

        UserInteraction.objects.create(user=user, product=product, interaction_type='add_to_cart', score=3.0)
        return Response(CartItemSerializer(item).data, status=status.HTTP_201_CREATED)


class CartItemAPIView(APIView):
    def put(self, request, item_id):
        user = _get_user(request)
        item = CartItem.objects.filter(cart_item_id=item_id, user=user).first()
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
        CartItem.objects.filter(cart_item_id=item_id, user=user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class WishlistAPIView(APIView):
    def get(self, request):
        user = _get_user(request)
        if not user:
            return Response([])
        items = WishlistItem.objects.filter(user=user).select_related('product', 'product__category', 'product__brand').prefetch_related('product__images', 'product__variants')
        return Response(WishlistItemSerializer(items, many=True).data)

    def post(self, request):
        user = _get_user(request)
        if not user:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        if WishlistItem.objects.filter(user=user).count() >= 100:
            return Response({'detail': 'Danh sach yeu thich toi da 100 san pham'}, status=status.HTTP_400_BAD_REQUEST)
        product = Product.objects.filter(product_id=request.data.get('product_id'), status='active').first()
        if product is None:
            return Response({'detail': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)
        item, _ = WishlistItem.objects.get_or_create(user=user, product=product)
        UserInteraction.objects.create(user=user, product=product, interaction_type='wishlist_add', score=2.5)
        return Response(WishlistItemSerializer(item).data, status=status.HTTP_201_CREATED)


class OrderListCreateAPIView(APIView):
    def get(self, request):
        user = _get_user(request)
        if not user:
            return Response([])
        orders = Order.objects.filter(user=user).prefetch_related('items', 'items__product', 'items__product__images', 'items__product__variants').order_by('-created_at')
        return Response(OrderSerializer(orders, many=True).data)

    @transaction.atomic
    def post(self, request):
        user = _get_user(request)
        if not user:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        selected_ids = request.data.get('cart_item_ids') or []
        cart_queryset = CartItem.objects.filter(user=user).select_related('product', 'variant')
        if selected_ids:
            cart_queryset = cart_queryset.filter(cart_item_id__in=selected_ids)
        cart_items = list(cart_queryset)
        if not cart_items:
            return Response({'detail': 'Cart is empty'}, status=status.HTTP_400_BAD_REQUEST)

        address = Address.objects.filter(user=user, is_default=True).first()
        if address is None:
            return Response({'detail': 'Vui long cap nhat dia chi giao hang mac dinh truoc khi dat hang'}, status=status.HTTP_400_BAD_REQUEST)

        for item in cart_items:
            if _available_stock(item.product, item.variant) < item.quantity:
                return Response({'detail': f'San pham {item.product.name} khong du ton kho'}, status=status.HTTP_400_BAD_REQUEST)

        subtotal = sum(int(item.variant.price if item.variant_id else item.product.base_price) * item.quantity for item in cart_items)
        shipping_fee = 0 if subtotal > 1_000_000 else 30_000
        order = Order.objects.create(
            user=user,
            address=address,
            total_amount=subtotal,
            shipping_fee=shipping_fee,
            discount_amount=0,
            final_amount=subtotal + shipping_fee,
            payment_method=request.data.get('payment_method', 'cod'),
        )
        for item in cart_items:
            price = int(item.variant.price if item.variant_id else item.product.base_price)
            OrderItem.objects.create(order=order, product=item.product, variant=item.variant, quantity=item.quantity, price=price)
            if item.variant_id:
                item.variant.stock_quantity -= item.quantity
                item.variant.save(update_fields=['stock_quantity'])
            UserInteraction.objects.create(user=user, product=item.product, interaction_type='purchase', score=5.0)

        Payment.objects.create(order=order, amount=order.final_amount, payment_method=order.payment_method, status='pending')
        CartItem.objects.filter(cart_item_id__in=[item.cart_item_id for item in cart_items], user=user).delete()
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
        if not user:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        CartItem.objects.filter(user=user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ApplyCouponAPIView(APIView):
    def post(self, request):
        user = _get_user(request)
        if not user:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        code = str(request.data.get('code', '')).strip().upper()
        coupon = Coupon.objects.filter(code__iexact=code, is_active=True).first()
        if coupon is None:
            return Response({'detail': 'Coupon khong hop le'}, status=status.HTTP_400_BAD_REQUEST)
        if coupon.expiry_date and coupon.expiry_date < timezone.localdate():
            return Response({'detail': 'Coupon da het han'}, status=status.HTTP_400_BAD_REQUEST)
        if coupon.usage_limit is not None and coupon.used_count >= coupon.usage_limit:
            return Response({'detail': 'Coupon da het luot su dung'}, status=status.HTTP_400_BAD_REQUEST)

        cart_items = CartItem.objects.filter(user=user).select_related('product', 'variant')
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
        order = Order.objects.filter(order_id=order_id, user=user).prefetch_related('items', 'items__product', 'items__product__images', 'items__product__variants').first()
        if order is None:
            return Response({'detail': 'Order not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrderSerializer(order).data)


class OrderCancelAPIView(APIView):
    @transaction.atomic
    def post(self, request, order_id):
        user = _get_user(request)
        order = Order.objects.filter(order_id=order_id, user=user).first()
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
        variant = ProductVariant.objects.select_for_update().filter(variant_id=request.data.get('variant_id')).first()
        if variant is None:
            return Response({'detail': 'Variant not found'}, status=status.HTTP_404_NOT_FOUND)
        try:
            change = int(request.data.get('change_quantity'))
        except (TypeError, ValueError):
            return Response({'detail': 'change_quantity khong hop le'}, status=status.HTTP_400_BAD_REQUEST)
        reason = str(request.data.get('reason', '')).strip()
        if not reason:
            return Response({'detail': 'Bat buoc nhap ly do dieu chinh kho'}, status=status.HTTP_400_BAD_REQUEST)
        variant.stock_quantity = max(0, variant.stock_quantity + change)
        variant.save(update_fields=['stock_quantity', 'updated_at'])
        InventoryLog.objects.create(product=variant.product, variant=variant, change=change, reason=reason[:100])
        return Response(ProductVariantSerializer(variant).data)


class LowStockAPIView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        variants = ProductVariant.objects.filter(stock_quantity__lte=models.F('low_stock_threshold')).select_related('product')
        return Response(ProductVariantSerializer(variants, many=True).data)
