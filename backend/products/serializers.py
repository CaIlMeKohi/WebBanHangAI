from datetime import timedelta
from decimal import Decimal, ROUND_HALF_UP
import json
import re

from django.db.models import F, Q
from django.utils import timezone
from rest_framework import serializers

from products.services.cloudinary_service import upload_product_image

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
    discountPercent = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    subcategory = serializers.SerializerMethodField()
    gender = serializers.CharField(read_only=True)
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
        return self._get_promotional_price(obj)[0]

    def get_originalPrice(self, obj: Product):
        return self._get_promotional_price(obj)[1]

    def get_discountPercent(self, obj: Product) -> int | None:
        return self._get_promotional_price(obj)[2]

    def _get_promotional_price(self, obj: Product) -> tuple[int, int | None, int | None]:
        cache = getattr(self, '_promotional_price_cache', None)
        if cache is None:
            cache = {}
            self._promotional_price_cache = cache
        if obj.product_id in cache:
            return cache[obj.product_id]

        base_price = Decimal(obj.base_price)
        best_discount = Decimal('0')
        category_ids = self._get_category_ancestor_ids(obj.category_id)

        for coupon in self._get_active_scoped_coupons():
            if coupon.product_id and coupon.product_id != obj.product_id:
                continue
            if coupon.category_id and coupon.category_id not in category_ids:
                continue

            if coupon.discount_type == 'percentage':
                discount = base_price * Decimal(coupon.discount_value) / Decimal('100')
                if coupon.max_discount is not None:
                    discount = min(discount, Decimal(coupon.max_discount))
            else:
                discount = Decimal(coupon.discount_value)

            best_discount = max(best_discount, min(discount, base_price))

        if best_discount <= 0 or base_price <= 0:
            result = (int(base_price), None, None)
        else:
            discounted_price = max(Decimal('0'), base_price - best_discount)
            percent = int(
                (best_discount * Decimal('100') / base_price).quantize(
                    Decimal('1'), rounding=ROUND_HALF_UP
                )
            )
            result = (int(discounted_price), int(base_price), max(1, percent))

        cache[obj.product_id] = result
        return result

    def _get_active_scoped_coupons(self) -> list[Coupon]:
        coupons = getattr(self, '_active_scoped_coupons', None)
        if coupons is None:
            now = timezone.now()
            coupons = list(
                Coupon.objects.filter(is_active=True)
                .filter(Q(start_at__isnull=True) | Q(start_at__lte=now))
                .filter(Q(end_at__isnull=True) | Q(end_at__gte=now))
                .filter(Q(usage_limit__isnull=True) | Q(used_count__lt=F('usage_limit')))
                .exclude(product__isnull=True, category__isnull=True)
            )
            self._active_scoped_coupons = coupons
        return coupons

    def _get_category_ancestor_ids(self, category_id: int) -> set[int]:
        parent_map = getattr(self, '_category_parent_map', None)
        if parent_map is None:
            parent_map = dict(Category.objects.values_list('category_id', 'parent_id'))
            self._category_parent_map = parent_map

        category_ids: set[int] = set()
        current_id = category_id
        while current_id is not None and current_id not in category_ids:
            category_ids.add(current_id)
            current_id = parent_map.get(current_id)
        return category_ids

    def get_image(self, obj: Product) -> str:
        primary = obj.images.filter(is_primary=True).first()
        if primary:
            return primary.image_url
        fallback = obj.images.first()
        return fallback.image_url if fallback else ''

    def get_category(self, obj: Product) -> str:
        return obj.category.slug

    def get_subcategory(self, obj: Product) -> str:
        return obj.category.slug

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
            'discountPercent',
            'image',
            'images',
            'category',
            'categoryName',
            'subcategory',
            'subcategoryName',
            'gender',
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
    status = serializers.ChoiceField(
        choices=['active', 'draft', 'hidden', 'discontinued'],
        required=False,
    )
    id = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    subcategory = serializers.SerializerMethodField()
    gender = serializers.ChoiceField(choices=['men', 'women', 'unisex'], required=False)
    stock_quantity = serializers.SerializerMethodField()
    variants = serializers.SerializerMethodField()
    category_id = serializers.PrimaryKeyRelatedField(
        queryset=Category.objects.filter(is_active=True),
        source='category',
    )
    brand_id = serializers.PrimaryKeyRelatedField(
        queryset=Brand.objects.all(),
        source='brand',
        allow_null=False,
        write_only=True
    )
    upload_image_url = serializers.CharField(max_length=500, write_only=True, required=False, source='image_url')
    image_file = serializers.FileField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Product
        fields = [
            'id',
            'product_id',
            'name',
            'slug',
            'description',
            'price',
            'image',
            'base_price',
            'category_id',
            'category',
            'subcategory',
            'gender',
            'brand_id',
            'average_rating',
            'review_count',
            'sold_count',
            'view_count',
            'feature_text',
            'tags',
            'status',
            'is_new',
            'is_bestseller',
            'stock_quantity',
            'variants',
            'image_url',
            'upload_image_url',
            'image_file',
        ]
        read_only_fields = ['product_id']

    def get_id(self, obj: Product) -> str:
        return str(obj.product_id)

    def get_price(self, obj: Product) -> int:
        return int(obj.base_price)

    def get_image(self, obj: Product) -> str:
        primary = obj.images.filter(is_primary=True).first()
        if primary:
            return primary.image_url
        fallback = obj.images.first()
        return fallback.image_url if fallback else ''

    def get_image_url(self, obj: Product) -> str:
        return self.get_image(obj)

    def get_category(self, obj: Product) -> str:
        return obj.category.slug

    def get_subcategory(self, obj: Product) -> str:
        return obj.category.slug

    def get_stock_quantity(self, obj: Product) -> int:
        return sum(max(0, variant.stock_quantity - variant.stock_reserved) for variant in obj.variants.all())

    def get_variants(self, obj: Product) -> list[dict]:
        return [
            {
                'variant_id': variant.variant_id,
                'size': variant.size,
                'color': variant.color,
                'stock_quantity': variant.stock_quantity,
                'is_active': variant.is_active,
            }
            for variant in obj.variants.order_by('variant_id')
        ]

    def _store_uploaded_image(self, uploaded_file) -> str:
        try:
            return upload_product_image(uploaded_file)
        except RuntimeError as exc:
            raise serializers.ValidationError({'image_file': str(exc)}) from exc

    def create(self, validated_data):
        image_url = validated_data.pop('image_url', None)
        image_file = validated_data.pop('image_file', None)
        variants = self._input_variants()

        if image_file is not None:
            image_url = self._store_uploaded_image(image_file)

        product = Product.objects.create(**validated_data)
        for variant_data in variants:
            ProductVariant.objects.create(
                product=product,
                sku=self._variant_sku(product, variant_data['size']),
                color='Mặc định',
                size=variant_data['size'],
                price=product.base_price,
                stock_quantity=variant_data['stock_quantity'],
                stock_reserved=0,
                low_stock_threshold=5,
                is_active=True,
            )

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
        variants = self._input_variants(required=False)

        if image_file is not None:
            image_url = self._store_uploaded_image(image_file)
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if variants is not None:
            selected_sizes = {item['size'] for item in variants}
            existing = {item.size: item for item in instance.variants.all()}
            for variant_data in variants:
                variant = existing.get(variant_data['size'])
                if variant is None:
                    ProductVariant.objects.create(
                        product=instance,
                        sku=self._variant_sku(instance, variant_data['size']),
                        color='Mặc định',
                        size=variant_data['size'],
                        price=instance.base_price,
                        stock_quantity=variant_data['stock_quantity'],
                        stock_reserved=0,
                        low_stock_threshold=5,
                        is_active=True,
                    )
                else:
                    variant.stock_quantity = variant_data['stock_quantity']
                    variant.price = instance.base_price
                    variant.is_active = True
                    variant.low_stock_threshold = max(5, variant.low_stock_threshold or 0)
                    variant.save(update_fields=['stock_quantity', 'price', 'is_active', 'low_stock_threshold', 'updated_at'])
            instance.variants.exclude(size__in=selected_sizes).update(is_active=False)

        if image_url:
            instance.images.filter(is_primary=True).delete()
            ProductImage.objects.create(
                product=instance,
                image_url=image_url,
                is_primary=True
            )
        
        return instance

    def _input_stock_quantity(self, default=None):
        raw_value = getattr(self, 'initial_data', {}).get('stock_quantity', default)
        if raw_value in (None, ''):
            return default
        try:
            return max(0, int(raw_value))
        except (TypeError, ValueError):
            raise serializers.ValidationError({'stock_quantity': 'Ton kho phai la so nguyen khong am'})

    def _input_variants(self, required=True):
        raw_value = getattr(self, 'initial_data', {}).get('variants')
        if raw_value in (None, ''):
            if not required:
                return None
            stock = self._input_stock_quantity(default=0)
            return [{'size': 'STD', 'stock_quantity': stock}]
        try:
            values = json.loads(raw_value) if isinstance(raw_value, str) else raw_value
        except json.JSONDecodeError as exc:
            raise serializers.ValidationError({'variants': 'Danh sách size không hợp lệ'}) from exc
        if not isinstance(values, list) or not values:
            raise serializers.ValidationError({'variants': 'Sản phẩm phải có ít nhất một size'})
        result = []
        seen = set()
        for item in values:
            size = str(item.get('size', '')).strip().upper()[:50]
            if not size or size in seen:
                raise serializers.ValidationError({'variants': 'Size không được trống hoặc trùng nhau'})
            try:
                stock_quantity = max(0, int(item.get('stock_quantity', 0)))
            except (TypeError, ValueError) as exc:
                raise serializers.ValidationError({'variants': f'Tồn kho size {size} không hợp lệ'}) from exc
            seen.add(size)
            result.append({'size': size, 'stock_quantity': stock_quantity})
        return result

    def _default_sku(self, product):
        base = ''.join(ch for ch in product.slug.upper() if ch.isalnum())[:32] or f'P{product.product_id}'
        sku = f'{base}-STD'
        if not ProductVariant.objects.filter(sku=sku).exists():
            return sku
        return f'{base}-{product.product_id}-STD'

    def _variant_sku(self, product, size):
        base = ''.join(ch for ch in product.slug.upper() if ch.isalnum())[:24] or f'P{product.product_id}'
        size_part = ''.join(ch for ch in size.upper() if ch.isalnum())[:16] or 'STD'
        candidate = f'{base}-{size_part}'
        if not ProductVariant.objects.filter(sku=candidate).exists():
            return candidate
        return f'{base}-{product.product_id}-{size_part}'


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
        category_ids = self._category_ids_with_descendants(obj)
        return Product.objects.filter(category_id__in=category_ids, status='active').count()

    def get_children(self, obj: Category) -> list[dict]:
        children = obj.children.all().order_by('name')
        return CategorySerializer(children, many=True).data

    def _category_ids_with_descendants(self, obj: Category) -> list[int]:
        category_ids = [obj.category_id]
        for child in obj.children.all():
            category_ids.extend(self._category_ids_with_descendants(child))
        return category_ids

    class Meta:
        model = Category
        fields = ['id', 'slug', 'name', 'parentSlug', 'productCount', 'children']


class StoreUserSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='email')
    full_name = serializers.SerializerMethodField()
    gender = serializers.SerializerMethodField()
    birthday = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()

    def get_full_name(self, obj: StoreUser) -> str:
        profile = getattr(obj, 'customer_profile', None)
        return profile.full_name if profile else obj.email

    def get_gender(self, obj: StoreUser) -> str:
        profile = getattr(obj, 'customer_profile', None)
        return profile.gender if profile else 'unknown'

    def get_birthday(self, obj: StoreUser) -> str | None:
        profile = getattr(obj, 'customer_profile', None)
        return profile.birthday.isoformat() if profile and profile.birthday else None

    def get_is_active(self, obj: StoreUser) -> bool:
        return obj.account_status == 'active'

    class Meta:
        model = StoreUser
        fields = ['user_id', 'username', 'full_name', 'email', 'phone', 'gender', 'birthday', 'role', 'is_active', 'created_at']
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

    def validate_birthday(self, value):
        if value is None:
            return value
        today = timezone.localdate()
        age = today.year - value.year - ((today.month, today.day) < (value.month, value.day))
        if age < 18:
            raise serializers.ValidationError('Ban phai du 18 tuoi moi duoc dang ky.')
        return value

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
    category_name = serializers.CharField(source='category.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = Coupon
        fields = [
            'coupon_id',
            'name',
            'code',
            'discount_type',
            'discount_value',
            'min_order_amount',
            'max_discount',
            'category',
            'category_name',
            'product',
            'product_name',
            'expiry_date',
            'start_at',
            'end_at',
            'usage_limit',
            'used_count',
            'per_customer_limit',
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
    has_review = serializers.SerializerMethodField()

    def get_has_review(self, obj: OrderItem) -> bool:
        return obj.reviews.exists()

    class Meta:
        model = OrderItem
        fields = [
            'order_item_id',
            'has_review',
            'product',
            'variant_id',
            'quantity',
            'price',
            'subtotal',
            'product_name_snapshot',
            'brand_name_snapshot',
            'category_name_snapshot',
            'sku_snapshot',
            'color_snapshot',
            'size_snapshot',
        ]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    customer = serializers.SerializerMethodField()
    shipping_address = serializers.SerializerMethodField()
    cancel_request_status = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    customer_code = serializers.SerializerMethodField()

    def get_cancel_request_status(self, obj: Order):
        request_item = obj.return_requests.filter(desired_solution='cancel_order').order_by('-created_at').first()
        return request_item.status if request_item else None

    def get_customer(self, obj: Order) -> dict:
        customer = obj.user
        user = customer.user if customer else None
        address = obj.address
        return {
            'customer_id': customer.customer_id if customer else None,
            'full_name': (
                (customer.full_name if customer else '')
                or obj.receiver_name_snapshot
                or (address.full_name if address else '')
                or (user.email if user else '')
            ),
            'email': user.email if user else '',
            'phone': (
                (user.phone if user else '')
                or obj.receiver_phone_snapshot
                or (address.phone if address else '')
            ),
            'customer_code': customer.customer_code if customer else '',
        }

    def get_customer_name(self, obj: Order) -> str:
        return self.get_customer(obj)['full_name']

    def get_customer_email(self, obj: Order) -> str:
        return self.get_customer(obj)['email']

    def get_customer_phone(self, obj: Order) -> str:
        return self.get_customer(obj)['phone']

    def get_customer_code(self, obj: Order) -> str:
        return self.get_customer(obj)['customer_code']

    def get_shipping_address(self, obj: Order) -> dict:
        address = obj.address
        return {
            'receiver_name': obj.receiver_name_snapshot or (address.full_name if address else ''),
            'receiver_phone': obj.receiver_phone_snapshot or (address.phone if address else ''),
            'address_line': obj.address_line_snapshot or (address.address_line if address else ''),
            'ward': obj.ward_snapshot or (address.ward if address else ''),
            'district': obj.district_snapshot or (address.district if address else ''),
            'province': obj.province_snapshot or (address.province if address else ''),
        }

    class Meta:
        model = Order
        fields = [
            'order_id',
            'customer',
            'customer_name',
            'customer_email',
            'customer_phone',
            'customer_code',
            'shipping_address',
            'total_amount',
            'shipping_fee',
            'discount_amount',
            'final_amount',
            'status',
            'payment_status',
            'payment_method',
            'cancel_request_status',
            'payment_expires_at',
            'created_at',
            'updated_at',
            'items',
        ]
