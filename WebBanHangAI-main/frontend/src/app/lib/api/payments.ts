import { apiPost } from "../apiClient";

export async function confirmMockPayment(
  orderId: number,
  provider = "bank_transfer",
) {
  return apiPost(`/payments/${provider}/callback`, {
    order_id: orderId,
    success: true,
    transaction_id: `QR-${orderId}-${Date.now()}`,
  });
}
