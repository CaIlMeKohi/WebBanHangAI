import type { Product } from "../../data/products";
import { apiGet, apiPost } from "../apiClient";

export interface ApiOrder {
  order_id: number;
  customer?: {
    customer_id?: number | null;
    full_name?: string;
    email?: string;
    phone?: string;
    customer_code?: string;
  };
  shipping_address?: {
    receiver_name?: string;
    receiver_phone?: string;
    address_line?: string;
    ward?: string;
    district?: string;
    province?: string;
  };
  total_amount: number;
  shipping_fee: number;
  discount_amount: number;
  final_amount: number;
  status: string;
  payment_status: string;
  payment_method: string;
  created_at: string;
  items: Array<{
    order_item_id: number;
    has_review?: boolean;
    product: Product;
    variant_id?: number | null;
    quantity: number;
    price: number;
    subtotal?: number;
    product_name_snapshot?: string;
    brand_name_snapshot?: string;
    category_name_snapshot?: string;
    sku_snapshot?: string;
    color_snapshot?: string;
    size_snapshot?: string;
  }>;
}

export async function fetchOrders(userId: number): Promise<ApiOrder[]> {
  return apiGet<ApiOrder[]>(`/products/orders/?user_id=${userId}`);
}

export async function createOrder(
  userId: number,
  paymentMethod = "cod",
  cartItemIds?: number[],
  options?: {
    address_id?: number;
    receiver_name?: string;
    receiver_phone?: string;
    coupon_code?: string;
  },
): Promise<ApiOrder> {
  return apiPost<ApiOrder>(`/products/orders/`, {
    user_id: userId,
    payment_method: paymentMethod,
    cart_item_ids: cartItemIds,
    ...options,
  });
}

export async function confirmOrderReceived(orderId: number): Promise<ApiOrder> {
  return apiPost<ApiOrder>(`/products/orders/${orderId}/confirm-received/`, {});
}

export async function cancelCustomerOrder(orderId: number, reason: string): Promise<ApiOrder> {
  return apiPost<ApiOrder>(`/products/orders/${orderId}/cancel/`, { reason });
}
