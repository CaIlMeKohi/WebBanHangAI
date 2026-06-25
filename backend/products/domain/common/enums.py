from __future__ import annotations

from enum import Enum


class UserRole(str, Enum):
    CUSTOMER = 'customer'
    STAFF = 'staff'
    ADMIN = 'admin'


class AccountStatus(str, Enum):
    ACTIVE = 'active'
    LOCKED = 'locked'
    INACTIVE = 'inactive'


class ProductStatus(str, Enum):
    ACTIVE = 'active'
    DRAFT = 'draft'
    HIDDEN = 'hidden'
    DISCONTINUED = 'discontinued'


class Gender(str, Enum):
    MEN = 'men'
    WOMEN = 'women'
    UNISEX = 'unisex'


class OrderStatus(str, Enum):
    PENDING = 'pending'
    CONFIRMED = 'confirmed'
    PROCESSING = 'processing'
    SHIPPED = 'shipped'
    DELIVERED = 'delivered'
    CANCELLED = 'cancelled'
    RETURN_REQUESTED = 'return_requested'
    RETURNED = 'returned'


class PaymentStatus(str, Enum):
    UNPAID = 'unpaid'
    PENDING = 'pending'
    PAID = 'paid'
    FAILED = 'failed'
    REFUNDED = 'refunded'
