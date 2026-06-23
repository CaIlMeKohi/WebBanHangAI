import { apiGet, apiPost } from "../apiClient";

export interface PayOSPayment {
  payment_id: number;
  status: string;
  amount: number;
  method: "payos";
  checkout_url: string;
  qr_code: string;
  payment_link_id: string;
  order_code: number;
}

export interface PaymentStatus {
  order_id: number;
  order_status: string;
  payment_status: string;
  payment_method: string;
  payment_id: number | null;
  status: string | null;
  amount: number;
  provider_status: string | null;
  checkout_url: string | null;
  expires_at: string | null;
  can_switch_to_cod: boolean;
  can_reorder_cod: boolean;
}

export async function createPayOSPayment(orderId: number) {
  return apiPost<PayOSPayment>("/payments/create", {
    order_id: orderId,
    method: "payos",
  });
}

export async function fetchPaymentStatus(orderId: number) {
  return apiGet<PaymentStatus>(`/payments/${orderId}/status`);
}

export async function switchPaymentToCOD(orderId: number) {
  return apiPost<PaymentStatus>(`/payments/${orderId}/switch-to-cod`, {});
}

export async function reorderAsCOD(orderId: number) {
  return apiPost<{ order_id: number }>(`/payments/${orderId}/reorder-cod`, {});
}
