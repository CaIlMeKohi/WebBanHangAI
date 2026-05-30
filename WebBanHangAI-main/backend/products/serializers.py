from datetime import timedelta
from pathlib import Path
import re
from uuid import uuid4

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Address,
    CartItem,
    Category,
    Brand,
    Customer,
    Order,
    OrderItem,
    Payment,
    Product,
    ProductImage,
    ProductVariant,
    StoreUser,
    UserInteraction,
    WishlistItem,
    Coupon,
)


class ProductSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    originalPrice = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    subcategory = serializers.SerializerMethodField()
    rating = serializers.FloatField(source='average_rating')
    reviews = serializers.IntegerField(source='review_count')
    colors = serializers.SerializerMethodField()
    sizes = serializers.SerializerMethodField()
    isNew = serializers.SerializerMethodField()
    isBestSeller = serializers.SerializerMethodField()
    isTrending = serializers.SerializerMethodField()
    slug = serializers.CharField(read_only=True)
    images = serializers.SerializerMethodField()
    categoryName = serializers.SerializerMethodField()
    subcategoryName = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source='created_at')
    brandName = serializers.SerializerMethodField()
    stockQuantity = serializers.SerializerMethodField()

    def get_id(self, obj: Product) -> str:
        return str(obj.product_id)

    def get_price(self, obj: Product) -> int:
        return int(obj.base_price)

    def get_originalPrice(self, obj: Product):
        return None

    def get_image(self, obj: Product) -> str:
        primary = obj.images.filter(is_primary=True).first()
        if primary:
            return primary.image_url
        fallback = obj.images.first()
        return fallback.image_url if fallback else ''

    def get_category(self, obj: Product) -> str:
        if obj.category.parent_id:
            return obj.category.parent.slug
        return obj.category.slug

    def get_subcategory(self, obj: Product) -> str:
        if obj.category.parent_id:
            return obj.category.slug
        child = obj.category.children.first()
        return child.slug if child else obj.category.slug

    def get_colors(self, obj: Product) -> list[str]:
        colors = []
        for variant in obj.variants.all():
            color = variant.color
            if color and color not in colors:
                colors.append(color)
        return colors or ['Mac dinh']

    def get_sizes(self, obj: Product) -> list[str]:
        sizes = []
        for variant in obj.variants.all():
            size = variant.size
            if size and size not in sizes:
                sizes.append(size)
        return sizes or ['STD']

    def get_isNew(self, obj: Product) -> bool:
        return bool(obj.is_new)

    def get_isBestSeller(self, obj: Product) -> bool:
        return bool(obj.is_bestseller)

    def get_isTrending(self, obj: Product) -> bool:
        return obj.view_count >= 100 or obj.sold_count >= 10

    def get_images(self, obj: Product) -> list[str]:
        return [image.image_url for image in obj.images.all()]

    def get_categoryName(self, obj: Product) -> str:
        if obj.category.parent_id:
            return obj.category.parent.name
        return obj.category.name

    def get_subcategoryName(self, obj: Product) -> str:
        return obj.category.name

    def get_brandName(self, obj: Product) -> str | None:
        return obj.brand.name if obj.brand_id else None

    def get_stockQuantity(self, obj: Product) -> int:
        return sum(max(0, variant.stock_quantity - variant.stock_reserved) for variant in obj.variants.all())

    class Meta:
        model = Product
        fields = [
            'id',
            'slug',
            'name',
            'price',
            'originalPrice',
            'image',
            'images',
            'category',
            'categoryName',
            'subcategory',
            'subcategoryName',
            'rating',
            'reviews',
            'colors',
            'sizes',
            'description',
            'isNew',
            'isBestSeller',
            'isTrending',
            'createdAt',
            'brandName',
            'stockQuantity',
        ]


class ProductAdminSerializer(serializers.ModelSerializer):
    """Serializer for admin CRUD operations (create/update/delete)"""
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.all(),
        source='category',
        write_only=True
    )
    brand_id = serializers.PrimaryKeyRelatedField(
        queryset=Brand.objects.all(),
        source='brand',
        allow_null=True,
        write_only=True
    )
    image_url = serializers.CharField(max_length=500, write_only=True, required=False)
    image_file = serializers.FileField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Product
        fields = [
            'product_id',
            'name',
            'slug',
            'description',
            'base_price',
            'category_id',
            'brand_id',
            'average_rating',
            'review_count',
            'sold_count',
            'view_count',
            'feature_text',
            'status',
            'is_new',
            'is_bestseller',
            'image_url',
            'image_file',
        ]
        read_only_fields = ['product_id']

    def _store_uploaded_image(self, uploaded_file) -> str:
        file_extension = Path(uploaded_file.name).suffix or '.jpg'
        storage_path = f'uploads/products/{uuid4().hex}{file_extension}'
        saved_path = default_storage.save(storage_path, ContentFile(uploaded_file.read()))
        return default_storage.url(saved_path)

    def create(self, validated_data):
        image_url = validated_data.pop('image_url', None)
        image_file = validated_data.pop('image_file', None)
        product = Product.objects.create(**validated_data)
        
        if image_file is not None:
            image_url = self._store_uploaded_image(image_file)

        if image_url:
            ProductImage.objects.create(
                product=product,
                image_url=image_url,
                is_primary=True
            )
        
        return product

    def update(self, instance, validated_data):
        image_url = validated_data.pop('image_url', None)
        image_file = validated_data.pop('image_file', None)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        if image_file is not None:
            image_url = self._store_uploaded_image(image_file)

        if image_url:
            instance.images.filter(is_primary=True).delete()
            ProductImage.objects.create(
                product=instance,
                image_url=image_url,
                is_primary=True
            )
        
        return instance


class UserProductEventSerializer(serializers.ModelSerializer):
    product_id = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all(), source='product')
    user_id = serializers.IntegerField(required=False, allow_null=True)

    def create(self, validated_data):
        user_id = validated_data.pop('user_id', None)
        if user_id is not None:
            validated_data['user_id'] = user_id
        return super().create(validated_data)

    class Meta:
        model = UserInteraction
        fields = [
            'interaction_id',
            'user_id',
            'product_id',
            'interaction_type',
            'session_id',
            'search_query',
            'score',
            'timestamp',
        ]
        read_only_fields = ['interaction_id', 'timestamp']


class CategorySerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='category_id')
    parentSlug = serializers.SerializerMethodField()
    productCount = serializers.SerializerMethodField()
    children = serializers.SerializerMethodField()

    def get_parentSlug(self, obj: Category) -> str | None:
        return obj.parent.slug if obj.parent_id else None

    def get_productCount(self, obj: Category) -> int:
        if obj.parent_id:
            return obj.products.filter(status='active').count()
        return Product.objects.filter(status='active').filter(Q(category=obj) | Q(category__parent=obj)).count()

    def get_children(self, obj: Category) -> list[dict]:
        children = obj.children.all().order_by('name')
        return CategorySerializer(children, many=True).data

    class Meta:
        model = Category
        fields = ['id', 'slug', 'name', 'parentSlug', 'productCount', 'children']


class StoreUserSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='email')
    full_name = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()

    def get_full_name(self, obj: StoreUser) -> str:
        profile = getattr(obj, 'customer_profile', None)
        return profile.full_name if profile else obj.email

    def get_is_active(self, obj: StoreUser) -> bool:
        return obj.account_status == 'active'

    class Meta:
        model = StoreUser
        fields = ['user_id', 'username', 'full_name', 'email', 'phone', 'role', 'is_active', 'created_at']
        read_only_fields = ['user_id', 'role', 'is_active', 'created_at']


class AuthSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()


class RegisterSerializer(serializers.Serializer):
    username = serializers.EmailField(max_length=254)
    full_name = serializers.CharField(max_length=255)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    gender = serializers.ChoiceField(choices=['male', 'female', 'other', 'unknown'], required=False, default='unknown')
    birthday = serializers.DateField(required=False, allow_null=True)
    password = serializers.CharField(min_length=8, max_length=64)

    def validate_username(self, value: str) -> str:
        email = value.strip().lower()
        if ' ' in email:
            raise serializers.ValidationError('Email khong duoc chua khoang trang.')
        return email

    def validate_full_name(self, value: str) -> str:
        full_name = value.strip()
        if len(full_name) < 2:
            raise serializers.ValidationError('Ho ten phai co it nhat 2 ky tu.')
        return full_name

    def validate_phone(self, value: str) -> str:
        phone = value.strip()
        if phone and (not phone.isdigit() or len(phone) < 9 or len(phone) > 20):
            raise serializers.ValidationError('So dien thoai khong hop le.')
        return phone

    def validate_password(self, value: str) -> str:
        if re.search(r'\s', value):
            raise serializers.ValidationError('Mat khau khong duoc chua khoang trang.')
        checks = [
            (r'[A-Z]', 'Mat khau phai co it nhat 1 chu hoa.'),
            (r'[a-z]', 'Mat khau phai co it nhat 1 chu thuong.'),
            (r'\d', 'Mat khau phai co it nhat 1 chu so.'),
            (r'[^A-Za-z0-9]', 'Mat khau phai co it nhat 1 ky tu dac biet.'),
        ]
        for pattern, message in checks:
            if not re.search(pattern, value):
                raise serializers.ValidationError(message)
        return value

    def validate(self, attrs):
        email = attrs['username']
        password = attrs['password']
        local_part = email.split('@', 1)[0]
        if email.lower() in password.lower() or local_part.lower() in password.lower():
            raise serializers.ValidationError({'password': 'Mat khau khong duoc trung hoac chua email.'})
        return attrs


class BrandSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source='brand_id', read_only=True)

    class Meta:
        model = Brand
        fields = ['id', 'brand_id', 'name', 'slug', 'logo_url', 'description', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['brand_id', 'created_at', 'updated_at']


class ProductVariantSerializer(serializers.ModelSerializer):
    available_stock = serializers.SerializerMethodField()

    def get_available_stock(self, obj: ProductVariant) -> int:
        return max(0, obj.stock_quantity - obj.stock_reserved)

    class Meta:
        model = ProductVariant
        fields = [
            'variant_id',
            'product',
            'sku',
            'color',
            'size',
            'price',
            'stock_quantity',
            'stock_reserved',
            'low_stock_threshold',
            'available_stock',
            'is_active',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['variant_id', 'created_at', 'updated_at', 'available_stock']


class CouponSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coupon
        fields = [
            'coupon_id',
            'code',
            'discount_type',
            'discount_value',
            'min_order_amount',
            'max_discount',
            'expiry_date',
            'usage_limit',
            'used_count',
            'is_active',
            'created_at',
        ]
        read_only_fields = ['coupon_id', 'used_count', 'created_at']


class CartItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(source='product.product_id', read_only=True)
    product = ProductSerializer(read_only=True)
    size = serializers.SerializerMethodField()
    color = serializers.SerializerMethodField()

    def get_size(self, obj: CartItem) -> str:
        if obj.variant_id:
            return obj.variant.size or 'STD'
        return 'STD'

    def get_color(self, obj: CartItem) -> str:
        if obj.variant_id:
            return obj.variant.color or 'Mac dinh'
        return 'Mac dinh'

    class Meta:
        model = CartItem
        fields = ['cart_item_id', 'product_id', 'product', 'variant_id', 'quantity', 'size', 'color', 'added_at']


class WishlistItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = WishlistItem
        fields = ['wishlist_item_id', 'product', 'added_at']


class AddressSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        for field in ['full_name', 'phone', 'address_line', 'ward', 'district', 'province']:
            value = attrs.get(field, getattr(self.instance, field, None))
            if not str(value or '').strip():
                raise serializers.ValidationError({field: 'Truong nay bat buoc.'})
        phone = str(attrs.get('phone', getattr(self.instance, 'phone', ''))).strip()
        if not phone.isdigit() or len(phone) < 9 or len(phone) > 20:
            raise serializers.ValidationError({'phone': 'So dien thoai khong hop le.'})
        return attrs

    class Meta:
        model = Address
        fields = ['address_id', 'full_name', 'phone', 'address_line', 'ward', 'district', 'province', 'is_default', 'created_at']
        read_only_fields = ['address_id', 'created_at']


class OrderItemSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = ['order_item_id', 'product', 'variant_id', 'quantity', 'price']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = Order
        fields = [
            'order_id',
            'total_amount',
            'shipping_fee',
            'discount_amount',
            'final_amount',
            'status',
            'payment_status',
            'payment_method',
            'created_at',
            'updated_at',
            'items',
        ]
