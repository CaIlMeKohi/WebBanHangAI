from datetime import timedelta
from pathlib import Path
from uuid import uuid4

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils import timezone
from rest_framework import serializers

from .models import Product, UserInteraction, Category, Brand, ProductImage, ProductVariant


class ProductSerializer(serializers.ModelSerializer):
    id = serializers.SerializerMethodField()
    price = serializers.SerializerMethodField()
    originalPrice = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    category = serializers.SerializerMethodField()
    subcategory = serializers.SerializerMethodField()
    rating = serializers.FloatField(source='average_rating')
    reviews = serializers.IntegerField(source='num_reviews')
    colors = serializers.SerializerMethodField()
    sizes = serializers.SerializerMethodField()
    isNew = serializers.SerializerMethodField()
    isBestSeller = serializers.SerializerMethodField()
    isTrending = serializers.SerializerMethodField()

    def get_id(self, obj: Product) -> str:
        return str(obj.product_id)

    def get_price(self, obj: Product) -> int:
        return obj.sale_price if obj.sale_price is not None else obj.price

    def get_originalPrice(self, obj: Product):
        return obj.price if obj.sale_price is not None else None

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
            color = variant.variant_attributes.get('color')
            if color and color not in colors:
                colors.append(color)
        return colors or ['Mac dinh']

    def get_sizes(self, obj: Product) -> list[str]:
        sizes = []
        for variant in obj.variants.all():
            size = variant.variant_attributes.get('size')
            if size and size not in sizes:
                sizes.append(size)
        return sizes or ['STD']

    def get_isNew(self, obj: Product) -> bool:
        return obj.created_at >= timezone.now() - timedelta(days=30)

    def get_isBestSeller(self, obj: Product) -> bool:
        return obj.num_reviews >= 150

    def get_isTrending(self, obj: Product) -> bool:
        return obj.interactions.count() >= 10

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'price',
            'originalPrice',
            'image',
            'category',
            'subcategory',
            'rating',
            'reviews',
            'colors',
            'sizes',
            'description',
            'isNew',
            'isBestSeller',
            'isTrending',
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
            'price',
            'sale_price',
            'stock_quantity',
            'category_id',
            'brand_id',
            'average_rating',
            'num_reviews',
            'feature_text',
            'is_active',
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
