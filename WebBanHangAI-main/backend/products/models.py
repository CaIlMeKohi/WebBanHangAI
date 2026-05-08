from django.db import models


class StoreUser(models.Model):
    ROLE_CHOICES = [('customer', 'Customer'), ('admin', 'Admin')]

    user_id = models.AutoField(primary_key=True)
    full_name = models.CharField(max_length=255)
    email = models.CharField(max_length=255, unique=True)
    password_hash = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='customer')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'users'


class Address(models.Model):
    address_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(StoreUser, on_delete=models.CASCADE, db_column='user_id', related_name='addresses')
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=20)
    address_line = models.CharField(max_length=255)
    ward = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    province = models.CharField(max_length=100)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'addresses'


class Category(models.Model):
    category_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    slug = models.CharField(max_length=255, unique=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, db_column='parent_id', related_name='children')
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'categories'


class Brand(models.Model):
    brand_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255, unique=True)
    logo_url = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'brands'


class Product(models.Model):
    product_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    slug = models.CharField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    price = models.IntegerField()
    sale_price = models.IntegerField(null=True, blank=True)
    stock_quantity = models.IntegerField(default=0)
    brand = models.ForeignKey(Brand, null=True, blank=True, on_delete=models.SET_NULL, db_column='brand_id', related_name='products')
    category = models.ForeignKey(Category, on_delete=models.PROTECT, db_column='category_id', related_name='products')
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    num_reviews = models.IntegerField(default=0)
    feature_text = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_new = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products'
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['price']),
            models.Index(fields=['created_at']),
        ]


class ProductVariant(models.Model):
    variant_id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='variants')
    sku = models.CharField(max_length=100, unique=True, null=True, blank=True)
    variant_attributes = models.JSONField(default=dict)
    price = models.IntegerField(null=True, blank=True)
    stock_quantity = models.IntegerField(default=0)

    class Meta:
        db_table = 'product_variants'


class ProductImage(models.Model):
    image_id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='images')
    image_url = models.CharField(max_length=500)
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = 'product_images'


class Tag(models.Model):
    tag_id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = 'tags'


class ProductTag(models.Model):
    product_tag_id = models.BigAutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='product_tags')
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, db_column='tag_id', related_name='tag_products')

    class Meta:
        db_table = 'product_tags'
        constraints = [models.UniqueConstraint(fields=['product', 'tag'], name='uniq_product_tag')]


class CartItem(models.Model):
    cart_item_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(StoreUser, on_delete=models.CASCADE, db_column='user_id', related_name='cart_items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='cart_items')
    variant = models.ForeignKey(ProductVariant, null=True, blank=True, on_delete=models.SET_NULL, db_column='variant_id', related_name='cart_items')
    quantity = models.IntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'cart_items'
        constraints = [models.UniqueConstraint(fields=['user', 'product', 'variant'], name='uniq_user_product_variant_cart')]


class WishlistItem(models.Model):
    wishlist_item_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(StoreUser, on_delete=models.CASCADE, db_column='user_id', related_name='wishlist_items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='wishlist_items')
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'wishlist_items'


class Coupon(models.Model):
    DISCOUNT_TYPE_CHOICES = [('percentage', 'Percentage'), ('fixed', 'Fixed')]

    coupon_id = models.AutoField(primary_key=True)
    code = models.CharField(max_length=50, unique=True)
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES)
    discount_value = models.IntegerField()
    min_order_amount = models.IntegerField(default=0)
    max_discount = models.IntegerField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    usage_limit = models.IntegerField(null=True, blank=True)
    used_count = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'coupons'


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('processing', 'Processing'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]
    PAYMENT_STATUS_CHOICES = [('unpaid', 'Unpaid'), ('paid', 'Paid'), ('refunded', 'Refunded')]
    PAYMENT_METHOD_CHOICES = [('cod', 'COD'), ('vnpay', 'VNPay'), ('momo', 'MoMo'), ('bank_transfer', 'Bank Transfer')]

    order_id = models.AutoField(primary_key=True)
    user = models.ForeignKey(StoreUser, on_delete=models.CASCADE, db_column='user_id', related_name='orders')
    address = models.ForeignKey(Address, on_delete=models.PROTECT, db_column='address_id', related_name='orders')
    total_amount = models.IntegerField()
    shipping_fee = models.IntegerField(default=0)
    discount_amount = models.IntegerField(default=0)
    coupon = models.ForeignKey(Coupon, null=True, blank=True, on_delete=models.SET_NULL, db_column='coupon_id', related_name='orders')
    final_amount = models.IntegerField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='unpaid')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'orders'
        indexes = [models.Index(fields=['user'])]


class OrderItem(models.Model):
    order_item_id = models.AutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, db_column='order_id', related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, db_column='product_id', related_name='order_items')
    variant = models.ForeignKey(ProductVariant, null=True, blank=True, on_delete=models.SET_NULL, db_column='variant_id', related_name='order_items')
    quantity = models.IntegerField()
    price = models.IntegerField()

    class Meta:
        db_table = 'order_items'


class Payment(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('success', 'Success'), ('failed', 'Failed')]
    PAYMENT_METHOD_CHOICES = [('cod', 'COD'), ('vnpay', 'VNPay'), ('momo', 'MoMo'), ('bank_transfer', 'Bank Transfer')]

    payment_id = models.AutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, db_column='order_id', related_name='payments')
    amount = models.IntegerField()
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    transaction_id = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'payments'


class Review(models.Model):
    review_id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='reviews')
    user = models.ForeignKey(StoreUser, on_delete=models.CASCADE, db_column='user_id', related_name='reviews')
    rating = models.PositiveSmallIntegerField()
    comment = models.TextField(null=True, blank=True)
    sentiment_score = models.FloatField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reviews'


class UserInteraction(models.Model):
    INTERACTION_TYPE_CHOICES = [
        ('view', 'View'),
        ('add_to_cart', 'Add To Cart'),
        ('wishlist_add', 'Wishlist Add'),
        ('search', 'Search'),
        ('purchase', 'Purchase'),
    ]

    interaction_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(StoreUser, null=True, blank=True, on_delete=models.SET_NULL, db_column='user_id', related_name='interactions')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='interactions')
    interaction_type = models.CharField(max_length=20, choices=INTERACTION_TYPE_CHOICES)
    session_id = models.CharField(max_length=100, null=True, blank=True)
    search_query = models.CharField(max_length=255, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)
    score = models.DecimalField(max_digits=5, decimal_places=2, default=1.0)

    class Meta:
        db_table = 'user_interactions'
        indexes = [models.Index(fields=['user']), models.Index(fields=['product']), models.Index(fields=['session_id'])]


class SearchLog(models.Model):
    search_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(StoreUser, null=True, blank=True, on_delete=models.SET_NULL, db_column='user_id', related_name='search_logs')
    session_id = models.CharField(max_length=100, null=True, blank=True)
    query = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'search_logs'


class PrecomputedRecommendation(models.Model):
    ALGO_CHOICES = [('collaborative_filtering', 'Collaborative Filtering'), ('content_based', 'Content Based'), ('hybrid', 'Hybrid')]

    rec_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(StoreUser, null=True, blank=True, on_delete=models.SET_NULL, db_column='user_id', related_name='precomputed_recommendations')
    session_id = models.CharField(max_length=100, null=True, blank=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='precomputed_recommendations')
    score = models.FloatField()
    rank = models.IntegerField()
    reason = models.TextField(blank=True)
    algorithm_type = models.CharField(max_length=40, choices=ALGO_CHOICES)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'precomputed_recommendations'


class RecommendationLog(models.Model):
    log_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(StoreUser, null=True, blank=True, on_delete=models.SET_NULL, db_column='user_id', related_name='recommendation_logs')
    session_id = models.CharField(max_length=100, null=True, blank=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='recommendation_logs')
    algorithm_type = models.CharField(max_length=50)
    clicked = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'recommendation_logs'


class InventoryLog(models.Model):
    log_id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='inventory_logs')
    variant = models.ForeignKey(ProductVariant, null=True, blank=True, on_delete=models.SET_NULL, db_column='variant_id', related_name='inventory_logs')
    change = models.IntegerField()
    reason = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'inventory_logs'
