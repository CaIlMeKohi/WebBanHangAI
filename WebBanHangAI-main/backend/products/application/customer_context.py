from __future__ import annotations

from dataclasses import dataclass

from products.models import Customer, StoreUser


@dataclass(frozen=True)
class CustomerContext:
    user: StoreUser
    customer: Customer


def get_active_user(user_id: int | str | None) -> StoreUser | None:
    if not user_id:
        return None
    return StoreUser.objects.filter(user_id=user_id, account_status='active').first()


def get_customer_for_user(user: StoreUser | None) -> Customer | None:
    if user is None:
        return None
    return Customer.objects.filter(user=user).first()


def get_customer_context(user_id: int | str | None) -> CustomerContext | None:
    user = get_active_user(user_id)
    customer = get_customer_for_user(user)
    if user is None or customer is None:
        return None
    return CustomerContext(user=user, customer=customer)
