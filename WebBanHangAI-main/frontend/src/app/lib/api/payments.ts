import { apiPost } from "../apiClient";

export async function confirmMockPayment(
  orderId: number,
) {
  return apiPost(`/payments/mock/confirm`, {
    order_id: orderId,
  });
}
