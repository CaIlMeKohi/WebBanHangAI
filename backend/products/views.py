import secrets

from django.db import DatabaseError, IntegrityError, models, transaction
from django.utils import timezone
from rest_framework import generics, status, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .application.customer_context import get_active_user, get_customer_for_user
from .infrastructure.stored_procedures import (
    check_variant_stock,
    hard_delete_product,
)
from .interfaces.api.catalog_views import (
    AdminBrandViewSet as CatalogAdminBrandViewSet,
    AdminCategoryViewSet as CatalogAdminCategoryViewSet,
    BrandListAPIView as CatalogBrandListAPIView,
    CategoryListAPIView as CatalogCategoryListAPIView,
    ProductDetailAPIView as CatalogProductDetailAPIView,
    ProductListAPIView as CatalogProductListAPIView,
)
from .interfaces.api.cart_views import (
    CartAPIView as CleanCartAPIView,
    CartItemAPIView as CleanCartItemAPIView,
)
from .interfaces.api.coupon_views import ApplyCouponAPIView as CleanApplyCouponAPIView
from .interfaces.api.inventory_views import (
    InventoryAdjustAPIView as CleanInventoryAdjustAPIView,
    LowStockAPIView as CleanLowStockAPIView,
    StockVariantListAPIView as CleanStockVariantListAPIView,
)
from .interfaces.api.order_views import (
    CustomerOrderAPIView as CleanCustomerOrderAPIView,
    CustomerOrderCancelAPIView as CleanCustomerOrderCancelAPIView,
    CustomerOrderConfirmReceivedAPIView as CleanCustomerOrderConfirmReceivedAPIView,
    CustomerOrderListAPIView as CleanCustomerOrderListAPIView,
    StaffOrderStatusAPIView as CleanStaffOrderStatusAPIView,
)
from .interfaces.api.user_views import (
    AuthLoginAPIView as CleanAuthLoginAPIView,
    AuthRegisterAPIView as CleanAuthRegisterAPIView,
)
from .interfaces.api.wishlist_views import WishlistAPIView as CleanWishlistAPIView
from .models import Address, AuditLog, CartItem, Coupon, Customer, Order, Product, ProductVariant, StoreUser, UserInteraction
from .security.permissions import IsAdmin, IsStaff
from .serializers import (
    AddressSerializer,
    CouponSerializer,
    OrderSerializer,
    UserProductEventSerializer,
    ProductAdminSerializer,
    ProductVariantSerializer,
    StoreUserSerializer,
)
from .application.orders.dto import CreateOrderDTO
from .application.orders.use_cases import CreateCustomerOrderUseCase
from .domain.common.exceptions import BusinessRuleViolation
from .infrastructure.django_orm.order_repository import DjangoOrmOrderRepository


class ProductListAPIView(CatalogProductListAPIView):
    """Compatibility wrapper for the existing /api/products/ route."""


class ProductDetailAPIView(CatalogProductDetailAPIView):
    """Compatibility wrapper for the existing /api/products/<id>/ route."""


class ProductAdminListCreateAPIView(generics.ListCreateAPIView):
    """Admin: List all products (including inactive) and create new ones"""
    queryset = Product.objects.all().select_related('category', 'brand').prefetch_related('images', 'variants')
    serializer_class = ProductAdminSerializer
    permission_classes = [IsAdmin]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def perform_create(self, serializer):
        product = serializer.save()
        AuditLog.objects.create(
            actor=self.request.user,
            action='create_product',
            entity_type='product',
            entity_id=str(product.product_id),
            metadata={
                'name': product.name,
                'slug': product.slug,
                'category_id': product.category_id,
                'brand_id': product.brand_id,
                'base_price': str(product.base_price),
                'status': product.status,
            },
        )


class ProductAdminUpdateDeleteAPIView(generics.RetrieveUpdateDestroyAPIView):
    """Admin: Update or delete a specific product"""
    queryset = Product.objects.all()
    serializer_class = ProductAdminSerializer
    lookup_field = 'product_id'
    lookup_url_kwarg = 'id'
    permission_classes = [IsAdmin]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def perform_update(self, serializer):
        before = self.get_object()
        old_value = {
            'name': before.name,
            'slug': before.slug,
            'category_id': before.category_id,
            'brand_id': before.brand_id,
            'base_price': str(before.base_price),
            'status': before.status,
            'gender': before.gender,
            'is_new': before.is_new,
        }
        product = serializer.save()
        AuditLog.objects.create(
            actor=self.request.user,
            action='update_product',
            entity_type='product',
            entity_id=str(product.product_id),
            old_value=old_value,
            metadata={
                'name': product.name,
                'slug': product.slug,
                'category_id': product.category_id,
                'brand_id': product.brand_id,
                'base_price': str(product.base_price),
                'status': product.status,
                'gender': product.gender,
                'is_new': product.is_new,
            },
        )

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        old_value = {
            'name': product.name,
            'slug': product.slug,
            'category_id': product.category_id,
            'brand_id': product.brand_id,
            'base_price': str(product.base_price),
            'status': product.status,
        }
        result = hard_delete_product(product.product_id)
        if not result.get('deleted'):
            return Response(
                {'detail': result.get('reason') or 'Khong the xoa san pham.'},
                status=status.HTTP_409_CONFLICT,
            )
        AuditLog.objects.create(
            actor=request.user,
            action='delete_product',
            entity_type='product',
            entity_id=str(product.product_id),
            old_value=old_value,
            metadata={'deleted': True},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProductAdminHistoryAPIView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request, id):
        items = (
            AuditLog.objects.filter(entity_type='product', entity_id=str(id))
            .select_related('actor')
            .order_by('-created_at')[:100]
        )
        return Response([
            {
                'audit_id': item.audit_id,
                'action': item.action,
                'actor_email': item.actor.email if item.actor else '',
                'old_value': item.old_value,
                'metadata': item.metadata,
                'created_at': item.created_at,
            }
            for item in items
        ])


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


class CategoryListAPIView(CatalogCategoryListAPIView):
    """Compatibility wrapper for the existing /api/products/categories/ route."""


class AuthLoginAPIView(CleanAuthLoginAPIView):
    """Compatibility wrapper for existing login routes."""


class AuthRegisterAPIView(CleanAuthRegisterAPIView):
    """Compatibility wrapper for existing register routes."""


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

        if 'phone' in request.data:
            user.phone = str(request.data.get('phone') or '').strip() or None
        user.save(update_fields=['phone'])
        profile, _ = Customer.objects.get_or_create(
            user=user,
            defaults={'customer_code': f'KH{user.user_id:06d}', 'full_name': user.email},
        )
        if 'full_name' in request.data:
            profile.full_name = str(request.data.get('full_name') or profile.full_name).strip()
        if 'gender' in request.data:
            gender = str(request.data.get('gender') or 'unknown').strip()
            if gender not in {'male', 'female', 'other', 'unknown'}:
                return Response({'detail': 'Gioi tinh khong hop le'}, status=status.HTTP_400_BAD_REQUEST)
            profile.gender = gender
        if 'birthday' in request.data:
            birthday = request.data.get('birthday') or None
            if birthday:
                try:
                    birthday_date = timezone.datetime.strptime(str(birthday), '%Y-%m-%d').date()
                except ValueError:
                    return Response({'detail': 'Ngay sinh khong hop le'}, status=status.HTTP_400_BAD_REQUEST)
                today = timezone.localdate()
                age = today.year - birthday_date.year - ((today.month, today.day) < (birthday_date.month, birthday_date.day))
                if age < 18:
                    return Response({'detail': 'Ban phai du 18 tuoi moi duoc cap nhat ngay sinh nay'}, status=status.HTTP_400_BAD_REQUEST)
                profile.birthday = birthday_date
            else:
                profile.birthday = None
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


class CartAPIView(CleanCartAPIView):
    """Compatibility wrapper for the existing /api/products/cart/ route."""


class CartItemAPIView(CleanCartItemAPIView):
    """Compatibility wrapper for the existing /api/products/cart/<item_id>/ route."""


class WishlistAPIView(CleanWishlistAPIView):
    """Compatibility wrapper for the existing /api/products/wishlist/ route."""


class OrderListCreateAPIView(CleanCustomerOrderListAPIView):
    @transaction.atomic
    def post(self, request):
        user = _get_user(request)
        customer = _get_customer(user)
        if not customer:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        try:
            order = CreateCustomerOrderUseCase(DjangoOrmOrderRepository()).execute(
                user,
                customer,
                CreateOrderDTO.from_payload(request.data),
            )
        except BusinessRuleViolation as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class BrandListAPIView(CatalogBrandListAPIView):
    """Compatibility wrapper for the existing /api/products/brands/ route."""


class AdminCategoryViewSet(CatalogAdminCategoryViewSet):
    """Compatibility wrapper for the existing admin category router."""


class AdminBrandViewSet(CatalogAdminBrandViewSet):
    """Compatibility wrapper for the existing admin brand router."""


class AdminVariantViewSet(viewsets.ModelViewSet):
    queryset = ProductVariant.objects.select_related('product').all().order_by('sku')
    serializer_class = ProductVariantSerializer
    permission_classes = [IsAdmin]


class AdminCouponViewSet(viewsets.ModelViewSet):
    queryset = Coupon.objects.all().order_by('-created_at')
    serializer_class = CouponSerializer
    permission_classes = [IsAdmin]

    def _generate_coupon_code(self):
        for _ in range(20):
            code = f'CP{timezone.now().strftime("%y%m%d")}{secrets.token_hex(3).upper()}'
            if not Coupon.objects.filter(code=code).exists():
                return code
        return f'CP{secrets.token_hex(8).upper()}'

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        if not str(data.get('code') or '').strip():
            data['code'] = self._generate_coupon_code()
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        coupon = serializer.instance
        AuditLog.objects.create(
            actor=request.user,
            action='create_coupon',
            entity_type='coupon',
            entity_id=str(coupon.coupon_id),
            metadata={
                'code': coupon.code,
                'name': getattr(coupon, 'name', ''),
                'discount_type': coupon.discount_type,
                'discount_value': str(coupon.discount_value),
            },
        )
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        try:
            return super().update(request, *args, **kwargs)
        except (DatabaseError, IntegrityError) as exc:
            return Response({'detail': f'Khong the cap nhat coupon: {exc}'}, status=status.HTTP_400_BAD_REQUEST)

    def perform_update(self, serializer):
        coupon = self.get_object()
        old_value = {
            'code': coupon.code,
            'name': getattr(coupon, 'name', ''),
            'discount_type': coupon.discount_type,
            'discount_value': str(coupon.discount_value),
            'is_active': coupon.is_active,
        }
        updated = serializer.save()
        AuditLog.objects.create(
            actor=self.request.user,
            action='update_coupon',
            entity_type='coupon',
            entity_id=str(updated.coupon_id),
            old_value=old_value,
            metadata={
                'code': updated.code,
                'name': getattr(updated, 'name', ''),
                'discount_type': updated.discount_type,
                'discount_value': str(updated.discount_value),
                'is_active': updated.is_active,
            },
        )

    def destroy(self, request, *args, **kwargs):
        coupon = self.get_object()
        old_value = {
            'code': coupon.code,
            'name': getattr(coupon, 'name', ''),
            'discount_type': coupon.discount_type,
            'discount_value': str(coupon.discount_value),
            'is_active': coupon.is_active,
        }
        coupon_id = coupon.coupon_id
        response = super().destroy(request, *args, **kwargs)
        AuditLog.objects.create(
            actor=request.user,
            action='delete_coupon',
            entity_type='coupon',
            entity_id=str(coupon_id),
            old_value=old_value,
            metadata={'deleted': True},
        )
        return response


class CartClearAPIView(APIView):
    def delete(self, request):
        user = _get_user(request)
        customer = _get_customer(user)
        if not customer:
            return Response({'detail': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        CartItem.objects.filter(cart__customer=customer).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ApplyCouponAPIView(CleanApplyCouponAPIView):
    """Compatibility wrapper for the existing /api/products/cart/apply-coupon/ route."""


class OrderDetailAPIView(CleanCustomerOrderAPIView):
    """Compatibility wrapper for the existing customer order detail route."""


class OrderCancelAPIView(CleanCustomerOrderCancelAPIView):
    """Compatibility wrapper for the existing customer order cancel route."""


class OrderConfirmReceivedAPIView(CleanCustomerOrderConfirmReceivedAPIView):
    """Compatibility wrapper for customer order received confirmation."""


class StaffOrderListAPIView(APIView):
    permission_classes = [IsStaff]

    def get(self, request):
        orders = Order.objects.filter(status__in=[
            'pending_payment',
            'pending',
            'confirmed',
            'processing',
            'waiting_pickup',
            'shipped',
            'delivered',
            'completed',
        ]).order_by('-created_at')
        status_param = request.query_params.get('status')
        payment_method = request.query_params.get('payment_method')
        if status_param:
            orders = orders.filter(status=status_param)
        if payment_method:
            orders = orders.filter(payment_method=payment_method)
        return Response(OrderSerializer(orders.prefetch_related('items', 'items__product'), many=True).data)


class StaffOrderStatusAPIView(CleanStaffOrderStatusAPIView):
    """Compatibility wrapper for the existing staff order status route."""


class InventoryAdjustAPIView(CleanInventoryAdjustAPIView):
    """Compatibility wrapper for the existing inventory adjust/import routes."""

    def post(self, request):
        variant_id = request.data.get('variant_id')
        before_variant = ProductVariant.objects.select_related('product').filter(variant_id=variant_id).first()
        old_value = None
        if before_variant is not None:
            old_value = {
                'product_id': before_variant.product_id,
                'product_name': before_variant.product.name,
                'variant_id': before_variant.variant_id,
                'sku': before_variant.sku,
                'color': before_variant.color,
                'size': before_variant.size,
                'stock_quantity': before_variant.stock_quantity,
                'stock_reserved': before_variant.stock_reserved,
            }
        response = super().post(request)
        if response.status_code == status.HTTP_200_OK and before_variant is not None:
            after_variant = ProductVariant.objects.select_related('product').filter(variant_id=variant_id).first()
            quantity = request.data.get('change_quantity')
            try:
                quantity_value = int(quantity)
            except (TypeError, ValueError):
                quantity_value = 0
            action_name = 'import_stock' if quantity_value > 0 else 'adjust_stock'
            AuditLog.objects.create(
                actor=request.user,
                action=action_name,
                entity_type='product',
                entity_id=str(before_variant.product_id),
                old_value=old_value,
                metadata={
                    'product_id': after_variant.product_id if after_variant else before_variant.product_id,
                    'product_name': after_variant.product.name if after_variant else before_variant.product.name,
                    'variant_id': after_variant.variant_id if after_variant else before_variant.variant_id,
                    'sku': after_variant.sku if after_variant else before_variant.sku,
                    'color': after_variant.color if after_variant else before_variant.color,
                    'size': after_variant.size if after_variant else before_variant.size,
                    'stock_quantity': after_variant.stock_quantity if after_variant else before_variant.stock_quantity,
                    'stock_reserved': after_variant.stock_reserved if after_variant else before_variant.stock_reserved,
                    'change_quantity': quantity_value,
                    'reason': request.data.get('reason', ''),
                },
            )
        return response


class LowStockAPIView(CleanLowStockAPIView):
    """Compatibility wrapper for the existing low stock route."""


class StockVariantListAPIView(CleanStockVariantListAPIView):
    """Compatibility wrapper for the existing staff inventory routes."""
