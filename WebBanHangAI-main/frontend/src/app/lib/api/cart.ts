import type { Product } from "../../data/products";
import { apiDelete, apiGet, apiPost, apiPut } from "../apiClient";

export interface ApiCartItem {
  cart_item_id: number;
  product_id: number;
  product: Product;
  variant_id: number | null;
  quantity: number;
  size: string;
  color: string;
}

export interface ApiAddress {
  address_id: number;
  full_name: string;
  phone: string;
  address_line: string;
  ward: string;
  district: string;
  province: string;
  is_default: boolean;
  created_at: string;
}

export type AddressPayload = Omit<ApiAddress, "address_id" | "created_at">;

export interface ApiCoupon {
  coupon_id: number;
  name: string;
  code: string;
  discount_type: "fixed" | "percentage";
  discount_value: number;
  min_order_amount: number;
  max_discount: number | null;
  category: number | null;
  category_name?: string;
  product: number | null;
  product_name?: string;
  start_at: string | null;
  end_at: string | null;
  expiry_date?: string;
  usage_limit: number | null;
  used_count: number;
  per_customer_limit: number;
  is_active: boolean;
}

export async function fetchCart(userId: number): Promise<ApiCartItem[]> {
  void userId;
  return apiGet<ApiCartItem[]>(`/products/cart/`);
}

export async function addCartItem(data: {
  user_id: number;
  product_id: number | string;
  variant_id?: number;
  quantity?: number;
  size?: string;
  color?: string;
}): Promise<ApiCartItem> {
  return apiPost<ApiCartItem>(`/products/cart/`, data);
}

export async function updateCartItem(
  userId: number,
  itemId: number,
  quantity: number,
): Promise<ApiCartItem> {
  void userId;
  return apiPut<ApiCartItem>(`/products/cart/${itemId}/`, {
    quantity,
  });
}

export async function deleteCartItem(
  userId: number,
  itemId: number,
): Promise<void> {
  void userId;
  return apiDelete(`/products/cart/${itemId}/`);
}

export async function fetchAddresses(userId: number): Promise<ApiAddress[]> {
  void userId;
  return apiGet<ApiAddress[]>(`/products/addresses/`);
}

export async function createAddress(
  userId: number,
  data: AddressPayload,
): Promise<ApiAddress> {
  void userId;
  return apiPost<ApiAddress>(`/products/addresses/`, {
    ...data,
  });
}

export async function updateAddress(
  userId: number,
  addressId: number,
  data: Partial<AddressPayload>,
): Promise<ApiAddress> {
  void userId;
  return apiPut<ApiAddress>(`/products/addresses/${addressId}/`, {
    ...data,
  });
}

export async function deleteAddress(
  userId: number,
  addressId: number,
): Promise<void> {
  void userId;
  return apiDelete(`/products/addresses/${addressId}/`);
}

export async function applyCouponToCart(data: {
  user_id: number;
  code: string;
  cart_item_ids?: number[];
}): Promise<{
  coupon: ApiCoupon;
  subtotal: number;
  discount_amount: number;
  final_amount: number;
}> {
  return apiPost<{
    coupon: ApiCoupon;
    subtotal: number;
    discount_amount: number;
    final_amount: number;
  }>(`/products/cart/apply-coupon/`, data);
}
