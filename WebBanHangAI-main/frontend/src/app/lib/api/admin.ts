import type { AdminProduct } from "../../types/admin";
import type { ApiCoupon } from "./cart";
import type { ApiOrder } from "./orders";
import {
  apiDelete,
  apiGet,
  apiPost,
  apiPostMultipart,
  apiPut,
  apiPutMultipart,
} from "../apiClient";

export interface AdminProductHistoryItem {
  audit_id: number;
  action: string;
  entity_type?: string;
  entity_id?: string;
  actor_email?: string;
  old_value?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export async function fetchAdminCoupons(): Promise<ApiCoupon[]> {
  const response = await apiGet<ApiCoupon[] | { results: ApiCoupon[] }>(
    `/products/admin/coupons/`,
  );
  return Array.isArray(response) ? response : response.results;
}

export async function createAdminCoupon(
  data: Partial<ApiCoupon>,
): Promise<ApiCoupon> {
  return apiPost<ApiCoupon>(`/products/admin/coupons/`, data);
}

export async function updateAdminCoupon(
  id: number,
  data: Partial<ApiCoupon>,
): Promise<ApiCoupon> {
  return apiPut<ApiCoupon>(`/products/admin/coupons/${id}/`, data);
}

export async function deleteAdminCoupon(id: number): Promise<void> {
  return apiDelete(`/products/admin/coupons/${id}/`);
}

export async function fetchAdminProducts(): Promise<AdminProduct[]> {
  return apiGet<AdminProduct[]>(`/products/admin/products/`);
}

export async function createAdminProduct(
  data: FormData,
): Promise<AdminProduct> {
  return apiPostMultipart<AdminProduct>(`/products/admin/products/`, data);
}

export async function updateAdminProduct(
  id: string,
  data: FormData,
): Promise<AdminProduct> {
  return apiPutMultipart<AdminProduct>(`/products/admin/products/${id}/`, data);
}

export async function deleteAdminProduct(id: string): Promise<void> {
  return apiDelete(`/products/admin/products/${id}/`);
}

export async function fetchAdminProductHistory(id: string): Promise<AdminProductHistoryItem[]> {
  return apiGet<AdminProductHistoryItem[]>(`/products/admin/products/${id}/history/`);
}

export async function fetchAdminAuditLogs(params: {
  entity_type?: string;
  action?: string[];
} = {}): Promise<AdminProductHistoryItem[]> {
  const query = new URLSearchParams();
  if (params.entity_type) query.set("entity_type", params.entity_type);
  params.action?.forEach((action) => query.append("action", action));
  const queryString = query.toString();
  return apiGet<AdminProductHistoryItem[]>(`/admin/audit-logs${queryString ? `?${queryString}` : ""}`);
}

export async function fetchAdminOrders(filters: Record<string, string> = {}): Promise<ApiOrder[]> {
  const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  const query = params.toString();
  const response = await apiGet<ApiOrder[] | { results: ApiOrder[] }>(
    `/admin/orders${query ? `?${query}` : ""}`,
  );
  return Array.isArray(response) ? response : response.results ?? [];
}

export async function updateAdminOrderStatus(
  orderId: number,
  data: {
    status: string;
    carrier_name?: string;
  },
): Promise<ApiOrder> {
  return apiPut<ApiOrder>(`/admin/orders/${orderId}/status`, data);
}

export async function completeAdminOrderRefund(
  orderId: number,
  refundReference: string,
): Promise<ApiOrder> {
  return apiPost<ApiOrder>(`/admin/orders/${orderId}/refund/complete`, {
    refund_reference: refundReference,
  });
}
