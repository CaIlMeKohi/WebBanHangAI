from django.db import models


class StoreUser(models.Model):
    ROLE_CHOICES = [('customer', 'Customer'), ('staff', 'Staff'), ('admin', 'Admin')]

    user_id = models.BigAutoField(primary_key=True)
    email = models.CharField(max_length=254, unique=True)
    password_hash = models.CharField(max_length=255)
    phone = models.CharField(max_length=20, blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='customer')
    account_status = models.CharField(max_length=30, default='active')
    email_verified_at = models.DateTimeField(null=True, blank=True)
    failed_login_count = models.IntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    last_login_at = models.DateTimeField(null=True, blank=True)
    must_change_password = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_active(self):
        return self.account_status == 'active'

    class Meta:
        db_table = 'users'


class Customer(models.Model):
    customer_id = models.BigAutoField(primary_key=True)
    user = models.OneToOneField(StoreUser, on_delete=models.CASCADE, db_column='user_id', related_name='customer_profile')
    customer_code = models.CharField(max_length=50, unique=True)
    full_name = models.CharField(max_length=255)
    gender = models.CharField(max_length=20, default='unknown')
    birthday = models.DateField(null=True, blank=True)
    avatar_url = models.CharField(max_length=500, null=True, blank=True)
    loyalty_points = models.IntegerField(default=0)
    customer_rank = models.CharField(max_length=50, default='standard')
    total_orders = models.IntegerField(default=0)
    total_spent = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    preferred_size = models.CharField(max_length=50, null=True, blank=True)
    preferred_color = models.CharField(max_length=100, null=True, blank=True)
    preferred_style = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customers'


class Address(models.Model):
    address_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(Customer, on_delete=models.CASCADE, db_column='customer_id', related_name='addresses')
    full_name = models.CharField(max_length=255, db_column='receiver_name')
    phone = models.CharField(max_length=20, db_column='receiver_phone')
    address_line = models.CharField(max_length=255)
    ward = models.CharField(max_length=100)
    district = models.CharField(max_length=100)
    province = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20, null=True, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'customer_addresses'


class Category(models.Model):
    category_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255)
    slug = models.CharField(max_length=255, unique=True)
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, db_column='parent_id', related_name='children')
    description = models.TextField(blank=True)
    image_url = models.CharField(max_length=500, blank=True)
    display_order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'categories'


class Brand(models.Model):
    brand_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255, unique=True)
    slug = models.CharField(max_length=255, unique=True)
    logo_url = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'brands'


class Product(models.Model):
    product_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=255)
    slug = models.CharField(max_length=255, unique=True)
    short_description = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)
    base_price = models.DecimalField(max_digits=12, decimal_places=2)
    brand = models.ForeignKey(Brand, on_delete=models.PROTECT, db_column='brand_id', related_name='products')
    category = models.ForeignKey(Category, on_delete=models.PROTECT, db_column='category_id', related_name='products')
    average_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0.00)
    review_count = models.IntegerField(default=0)
    sold_count = models.IntegerField(default=0)
    view_count = models.IntegerField(default=0)
    feature_text = models.TextField(blank=True)
    status = models.CharField(max_length=20, default='active')
    is_new = models.BooleanField(default=False)
    is_bestseller = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'products'
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['base_price']),
            models.Index(fields=['created_at']),
        ]


class ProductVariant(models.Model):
    variant_id = models.BigAutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='variants')
    sku = models.CharField(max_length=100, unique=True)
    color = models.CharField(max_length=100)
    size = models.CharField(max_length=50)
    price = models.DecimalField(max_digits=12, decimal_places=2)
    stock_quantity = models.IntegerField(default=0)
    stock_reserved = models.IntegerField(default=0)
    low_stock_threshold = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'product_variants'


class ProductImage(models.Model):
    image_id = models.BigAutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='images')
    variant = models.ForeignKey(ProductVariant, null=True, blank=True, on_delete=models.SET_NULL, db_column='variant_id', related_name='images')
    image_url = models.CharField(max_length=500)
    alt_text = models.CharField(max_length=255, blank=True)
    is_primary = models.BooleanField(default=False)
    display_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

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


class Cart(models.Model):
    cart_id = models.BigAutoField(primary_key=True)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, db_column='customer_id', related_name='carts')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'carts'


class CartItem(models.Model):
    cart_item_id = models.BigAutoField(primary_key=True)
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, db_column='cart_id', related_name='items')
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, db_column='variant_id', related_name='cart_items')
    quantity = models.IntegerField(default=1)
    added_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def product(self):
        return self.variant.product if self.variant_id else None

    class Meta:
        db_table = 'cart_items'


class WishlistItem(models.Model):
    wishlist_item_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(Customer, on_delete=models.CASCADE, db_column='customer_id', related_name='wishlist_items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='wishlist_items')
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'wishlist_items'


class Coupon(models.Model):
    DISCOUNT_TYPE_CHOICES = [('percentage', 'Percentage'), ('fixed', 'Fixed')]

    coupon_id = models.BigAutoField(primary_key=True)
    code = models.CharField(max_length=50, unique=True)
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPE_CHOICES, db_column='coupon_type')
    discount_value = models.DecimalField(max_digits=14, decimal_places=2)
    min_order_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    max_discount = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    usage_limit = models.IntegerField(null=True, blank=True)
    used_count = models.IntegerField(default=0)
    per_customer_limit = models.IntegerField(default=1)
    start_at = models.DateTimeField(null=True, blank=True)
    end_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def expiry_date(self):
        return self.end_at.date() if self.end_at else None

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

    order_id = models.BigAutoField(primary_key=True)
    order_code = models.CharField(max_length=50)
    user = models.ForeignKey(Customer, on_delete=models.CASCADE, db_column='customer_id', related_name='orders')
    address = models.ForeignKey(Address, on_delete=models.PROTECT, db_column='address_id', related_name='orders')
    receiver_name_snapshot = models.CharField(max_length=255, default='')
    receiver_phone_snapshot = models.CharField(max_length=20, default='')
    address_line_snapshot = models.CharField(max_length=255, default='')
    ward_snapshot = models.CharField(max_length=100, default='')
    district_snapshot = models.CharField(max_length=100, default='')
    province_snapshot = models.CharField(max_length=100, default='')
    postal_code_snapshot = models.CharField(max_length=20, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, db_column='subtotal_amount')
    shipping_fee = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    coupon = models.ForeignKey(Coupon, null=True, blank=True, on_delete=models.SET_NULL, db_column='coupon_id', related_name='orders')
    final_amount = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_column='order_status')
    payment_status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='unpaid')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'orders'
        indexes = [models.Index(fields=['user'])]


class OrderItem(models.Model):
    order_item_id = models.BigAutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, db_column='order_id', related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, db_column='product_id', related_name='order_items')
    variant = models.ForeignKey(ProductVariant, on_delete=models.PROTECT, db_column='variant_id', related_name='order_items')
    product_name_snapshot = models.CharField(max_length=255, default='')
    brand_name_snapshot = models.CharField(max_length=255, default='')
    category_name_snapshot = models.CharField(max_length=255, default='')
    sku_snapshot = models.CharField(max_length=100, default='')
    color_snapshot = models.CharField(max_length=100, default='')
    size_snapshot = models.CharField(max_length=50, default='')
    price = models.DecimalField(max_digits=14, decimal_places=2, db_column='unit_price')
    quantity = models.IntegerField()
    subtotal = models.DecimalField(max_digits=14, decimal_places=2, default=0)

    class Meta:
        db_table = 'order_items'


class Payment(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('success', 'Success'), ('failed', 'Failed')]
    PAYMENT_METHOD_CHOICES = [('cod', 'COD'), ('vnpay', 'VNPay'), ('momo', 'MoMo'), ('bank_transfer', 'Bank Transfer')]

    payment_id = models.BigAutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, db_column='order_id', related_name='payments')
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, db_column='method')
    transaction_id = models.CharField(max_length=255, null=True, blank=True, db_column='transaction_code')
    gateway_response = models.TextField(null=True, blank=True)
    failure_reason = models.CharField(max_length=255, null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    paid_at = models.DateTimeField(null=True, blank=True)
    refunded_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payments'


class Review(models.Model):
    review_id = models.AutoField(primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='reviews')
    user = models.ForeignKey(StoreUser, on_delete=models.CASCADE, db_column='customer_id', related_name='reviews')
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
        ('review', 'Review'),
    ]

    interaction_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(StoreUser, null=True, blank=True, on_delete=models.SET_NULL, db_column='customer_id', related_name='interactions')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='interactions')
    interaction_type = models.CharField(max_length=20, choices=INTERACTION_TYPE_CHOICES)
    session_id = models.CharField(max_length=100, null=True, blank=True)
    search_query = models.CharField(max_length=255, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_column='created_at')
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

    rec_id = models.BigAutoField(primary_key=True, db_column='recommendation_id')
    user = models.ForeignKey(StoreUser, null=True, blank=True, on_delete=models.SET_NULL, db_column='customer_id', related_name='precomputed_recommendations')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='precomputed_recommendations')
    score = models.FloatField()
    rank = models.IntegerField(db_column='recommendation_rank')
    reason = models.TextField(blank=True)
    algorithm_type = models.CharField(max_length=40, choices=ALGO_CHOICES)
    generated_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'precomputed_recommendations'


class RecommendationLog(models.Model):
    log_id = models.BigAutoField(primary_key=True, db_column='recommendation_log_id')
    user = models.ForeignKey(StoreUser, null=True, blank=True, on_delete=models.SET_NULL, db_column='customer_id', related_name='recommendation_logs')
    session_id = models.CharField(max_length=100, null=True, blank=True)
    algorithm_type = models.CharField(max_length=50)
    product = models.ForeignKey(Product, on_delete=models.CASCADE, db_column='product_id', related_name='recommendation_logs')
    created_at = models.DateTimeField(auto_now_add=True)
    clicked = models.BooleanField(default=False)

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


class EmailVerificationToken(models.Model):
    token_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(StoreUser, on_delete=models.CASCADE, db_column='user_id', related_name='email_verification_tokens')
    token = models.CharField(max_length=128, unique=True, db_column='token_hash')
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    resend_count = models.IntegerField(default=0)
    last_sent_at = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'email_verification_tokens'


class PasswordResetOTP(models.Model):
    otp_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(StoreUser, on_delete=models.CASCADE, db_column='user_id', related_name='password_reset_otps')
    otp_hash = models.CharField(max_length=255)
    expires_at = models.DateTimeField()
    failed_attempts = models.IntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'password_reset_otps'


class LoginLog(models.Model):
    log_id = models.BigAutoField(primary_key=True, db_column='login_log_id')
    user = models.ForeignKey(StoreUser, null=True, blank=True, on_delete=models.SET_NULL, db_column='user_id', related_name='login_logs')
    identifier = models.CharField(max_length=254, db_column='email_or_phone')
    success = models.BooleanField(default=False)
    ip_address = models.CharField(max_length=64, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    reason = models.CharField(max_length=255, blank=True, db_column='failure_reason')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'login_logs'


class AuditLog(models.Model):
    audit_id = models.BigAutoField(primary_key=True, db_column='audit_log_id')
    actor = models.ForeignKey(StoreUser, null=True, blank=True, on_delete=models.SET_NULL, db_column='actor_user_id', related_name='audit_logs')
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=100, db_column='target_table')
    entity_id = models.CharField(max_length=100, blank=True, db_column='target_id')
    old_value = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True, db_column='new_value')
    ip_address = models.CharField(max_length=64, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_logs'


class OrderStatusHistory(models.Model):
    history_id = models.BigAutoField(primary_key=True)
    order = models.ForeignKey(Order, on_delete=models.CASCADE, db_column='order_id', related_name='status_histories')
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    note = models.CharField(max_length=500, blank=True)
    changed_by = models.ForeignKey(StoreUser, null=True, blank=True, on_delete=models.SET_NULL, db_column='changed_by', related_name='order_status_changes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'order_status_histories'


class Shipment(models.Model):
    shipment_id = models.BigAutoField(primary_key=True)
    order = models.OneToOneField(Order, on_delete=models.CASCADE, db_column='order_id', related_name='shipment')
    carrier_name = models.CharField(max_length=100)
    tracking_code = models.CharField(max_length=100)
    shipment_status = models.CharField(max_length=30, default='pending')
    shipped_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'shipments'


class ReturnRequest(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('approved', 'Approved'), ('rejected', 'Rejected'), ('completed', 'Completed')]

    return_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(StoreUser, on_delete=models.CASCADE, db_column='user_id', related_name='return_requests')
    order = models.ForeignKey(Order, on_delete=models.CASCADE, db_column='order_id', related_name='return_requests')
    order_item = models.ForeignKey(OrderItem, null=True, blank=True, on_delete=models.SET_NULL, db_column='order_item_id', related_name='return_requests')
    reason = models.TextField()
    desired_solution = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reject_reason = models.TextField(blank=True)
    processed_by = models.ForeignKey(StoreUser, null=True, blank=True, on_delete=models.SET_NULL, db_column='processed_by', related_name='processed_returns')
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'return_requests'


class ReturnRequestImage(models.Model):
    image_id = models.BigAutoField(primary_key=True)
    return_request = models.ForeignKey(ReturnRequest, on_delete=models.CASCADE, db_column='return_id', related_name='images')
    image_url = models.CharField(max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'return_request_images'


class ReturnStatusHistory(models.Model):
    history_id = models.BigAutoField(primary_key=True)
    return_request = models.ForeignKey(ReturnRequest, on_delete=models.CASCADE, db_column='return_id', related_name='status_histories')
    from_status = models.CharField(max_length=20, blank=True)
    to_status = models.CharField(max_length=20)
    note = models.CharField(max_length=500, blank=True)
    changed_by = models.ForeignKey(StoreUser, null=True, blank=True, on_delete=models.SET_NULL, db_column='changed_by', related_name='return_status_changes')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'return_status_histories'


class Notification(models.Model):
    notification_id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(StoreUser, on_delete=models.CASCADE, db_column='user_id', related_name='notifications')
    title = models.CharField(max_length=255)
    content = models.TextField()
    notification_type = models.CharField(max_length=50, default='system')
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications'


class PaymentMethod(models.Model):
    method_id = models.BigAutoField(primary_key=True)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payment_methods'


class RecommendationConfig(models.Model):
    config_id = models.BigAutoField(primary_key=True)
    config_key = models.CharField(max_length=100, unique=True)
    config_value = models.JSONField(default=dict, blank=True)
    description = models.CharField(max_length=255, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recommendation_configs'
