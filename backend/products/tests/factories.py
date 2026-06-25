from __future__ import annotations

from decimal import Decimal
from itertools import count

from django.contrib.auth.hashers import make_password
from django.utils import timezone

from products.models import (
    Address,
    AdminProfile,
    Brand,
    Cart,
    CartItem,
    Category,
    Coupon,
    Customer,
    Order,
    OrderItem,
    Payment,
    Product,
    ProductImage,
    ProductVariant,
    StaffProfile,
    StoreUser,
)
from products.security.authentication import create_access_token


_seq = count(1)
DEFAULT_PASSWORD = "StrongPass1!"


def unique(prefix: str) -> str:
    return f"{prefix}-{next(_seq)}"


def auth_headers(user: StoreUser) -> dict[str, str]:
    return {"HTTP_AUTHORIZATION": f"Bearer {create_access_token(user)}"}


def create_user(role: str = "customer", email: str | None = None, password: str = DEFAULT_PASSWORD) -> StoreUser:
    user = StoreUser.objects.create(
        email=email or f"{unique(role)}@example.com",
        phone=f"090{next(_seq):07d}"[:10],
        password_hash=make_password(password),
        role=role,
        account_status="active",
        email_verified_at=timezone.now(),
    )
    return user


def create_customer_user(email: str | None = None, password: str = DEFAULT_PASSWORD):
    user = create_user("customer", email=email, password=password)
    customer = Customer.objects.create(
        user=user,
        customer_code=f"KH{user.user_id:06d}",
        full_name="Test Customer",
    )
    return user, customer


def create_staff_user(email: str | None = None, password: str = DEFAULT_PASSWORD):
    user = create_user("staff", email=email, password=password)
    staff = StaffProfile.objects.create(
        user=user,
        staff_code=f"NV{user.user_id:06d}",
        full_name="Test Staff",
        position="staff",
        department="operations",
    )
    return user, staff


def create_admin_user(email: str | None = None, password: str = DEFAULT_PASSWORD):
    user = create_user("admin", email=email, password=password)
    admin = AdminProfile.objects.create(
        user=user,
        admin_code=f"AD{user.user_id:06d}",
        full_name="Test Admin",
    )
    return user, admin


def create_category(name: str | None = None, slug: str | None = None) -> Category:
    label = name or unique("Category")
    return Category.objects.create(name=label, slug=slug or label.lower().replace(" ", "-"))


def create_brand(name: str | None = None, slug: str | None = None) -> Brand:
    label = name or unique("Brand")
    return Brand.objects.create(name=label, slug=slug or label.lower().replace(" ", "-"))


def create_product(
    *,
    name: str | None = None,
    category: Category | None = None,
    brand: Brand | None = None,
    gender: str = "unisex",
    price: int = 100000,
    status: str = "active",
    stock: int = 10,
) -> Product:
    label = name or unique("Product")
    product = Product.objects.create(
        name=label,
        slug=label.lower().replace(" ", "-"),
        description=f"{label} description",
        base_price=Decimal(price),
        category=category or create_category(),
        brand=brand or create_brand(),
        gender=gender,
        status=status,
    )
    variant = create_variant(product=product, price=price, stock=stock)
    create_product_image(product, variant=variant)
    return product


def create_variant(
    *,
    product: Product,
    sku: str | None = None,
    price: int | None = None,
    stock: int = 10,
    color: str = "Black",
    size: str = "M",
) -> ProductVariant:
    return ProductVariant.objects.create(
        product=product,
        sku=sku or unique("SKU").upper(),
        color=color,
        size=size,
        price=Decimal(price if price is not None else product.base_price),
        stock_quantity=stock,
        stock_reserved=0,
        low_stock_threshold=1,
    )


def create_product_image(product: Product, variant: ProductVariant | None = None) -> ProductImage:
    return ProductImage.objects.create(
        product=product,
        variant=variant,
        image_url=f"https://example.com/{product.slug}.jpg",
        is_primary=True,
    )


def create_cart(customer: Customer) -> Cart:
    cart, _ = Cart.objects.get_or_create(customer=customer)
    return cart


def create_cart_item(customer: Customer, variant: ProductVariant, quantity: int = 1) -> CartItem:
    cart = create_cart(customer)
    return CartItem.objects.create(cart=cart, variant=variant, quantity=quantity)


def create_coupon(
    *,
    code: str | None = None,
    discount_type: str = "fixed",
    discount_value: int = 10000,
    min_order_amount: int = 0,
    is_active: bool = True,
    end_at=None,
) -> Coupon:
    return Coupon.objects.create(
        code=code or unique("CP").upper(),
        discount_type=discount_type,
        discount_value=Decimal(discount_value),
        min_order_amount=Decimal(min_order_amount),
        is_active=is_active,
        end_at=end_at,
    )


def create_address(customer: Customer) -> Address:
    return Address.objects.create(
        user=customer,
        full_name="Receiver Name",
        phone="0912345678",
        address_line="123 Test Street",
        ward="Ward",
        district="District",
        province="Province",
        is_default=True,
    )


def create_order(
    *,
    customer: Customer,
    address: Address | None = None,
    status: str = "pending",
    payment_method: str = "cod",
    payment_status: str = "unpaid",
    total: int = 100000,
) -> Order:
    address = address or create_address(customer)
    return Order.objects.create(
        user=customer,
        address=address,
        order_code=unique("ORD").upper(),
        receiver_name_snapshot=address.full_name,
        receiver_phone_snapshot=address.phone,
        address_line_snapshot=address.address_line,
        ward_snapshot=address.ward,
        district_snapshot=address.district,
        province_snapshot=address.province,
        total_amount=Decimal(total),
        shipping_fee=Decimal(30000),
        discount_amount=Decimal(0),
        final_amount=Decimal(total + 30000),
        status=status,
        payment_status=payment_status,
        payment_method=payment_method,
    )


def create_order_item(order: Order, product: Product | None = None, variant: ProductVariant | None = None, quantity: int = 1) -> OrderItem:
    product = product or create_product()
    variant = variant or product.variants.first() or create_variant(product=product)
    price = Decimal(variant.price)
    return OrderItem.objects.create(
        order=order,
        product=product,
        variant=variant,
        product_name_snapshot=product.name,
        brand_name_snapshot=product.brand.name,
        category_name_snapshot=product.category.name,
        sku_snapshot=variant.sku,
        color_snapshot=variant.color,
        size_snapshot=variant.size,
        price=price,
        quantity=quantity,
        subtotal=price * quantity,
    )


def create_payment(order: Order, status: str = "pending") -> Payment:
    return Payment.objects.create(
        order=order,
        amount=order.final_amount,
        payment_method=order.payment_method,
        status=status,
    )
