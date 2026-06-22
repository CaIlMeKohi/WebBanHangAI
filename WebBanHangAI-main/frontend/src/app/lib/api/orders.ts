import type { Product } from "../../data/products";
import { apiGet, apiPost } from "../apiClient";

export interface ApiShipment {
  shipment_id: number;
  carrier_name: string;
  tracking_code: string;
  shipment_status: string;
  shipped_at?: string | null;
  delivered_at?: string | null;
}

export interface ApiOrderStatusHistory {
  history_id: number;
  from_status: string;
  to_status: string;
  note: string;
  created_at: string;
}

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
  shipment?: ApiShipment | null;
  status_histories?: ApiOrderStatusHistory[];
  items: Array<{
    order_item_id: number;
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
  void userId;
  return apiGet<ApiOrder[]>(`/products/orders/`);
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
    checkout_token?: string;
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

export interface ApiReturnRequest {
  return_id: number;
  order: number;
  order_item: number;
  reason: string;
  desired_solution: string;
  status: string;
  reject_reason?: string;
  created_at: string;
  images?: Array<{ image_id: number; image_url: string }>;
  status_histories?: Array<{
    history_id: number;
    from_status: string;
    to_status: string;
    note: string;
    created_at: string;
  }>;
}

export async function fetchReturnRequests(): Promise<ApiReturnRequest[]> {
  return apiGet<ApiReturnRequest[]>(`/returns/my`);
}

export async function createReturnRequest(data: {
  order_id: number;
  order_item_id: number;
  reason: string;
  desired_solution: string;
  images: string[];
}): Promise<ApiReturnRequest> {
  return apiPost<ApiReturnRequest>(`/returns/`, data);
}
