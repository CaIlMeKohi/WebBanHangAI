import { useNavigate, useSearchParams } from "react-router";
import { CheckCircle2 } from "lucide-react";

import { confirmMockPayment } from "../../lib/api";

export function MockPaymentGateway() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = Number(params.get("orderId") ?? 0);
  const amount = Number(params.get("amount") ?? 0);
  const returnTo = params.get("returnTo") ?? "/cart";

  async function confirm() {
    if (!orderId) return;
    await confirmMockPayment(orderId);
    navigate(`${returnTo}?payment=success&orderId=${orderId}`, {
      replace: true,
    });
  }

  return (
    <main className="min-h-screen bg-emerald-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-600" />
        <h1 className="text-2xl font-semibold text-neutral-950">
          Đã thanh toán
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Giao dịch cho đơn #{orderId} đã được ghi nhận trên cổng thanh toán giả
          lập.
        </p>
        <div className="mt-5 rounded-md bg-neutral-50 p-4 text-sm">
          <div className="flex justify-between">
            <span>Số tiền</span>
            <strong>{amount.toLocaleString("vi-VN")} VND</strong>
          </div>
          <div className="mt-2 flex justify-between">
            <span>Phương thức</span>
            <strong>QR / Bank Transfer</strong>
          </div>
        </div>
        <button
          onClick={() => void confirm()}
          disabled={!orderId}
          className="mt-6 w-full rounded-md bg-neutral-950 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          Xác nhận và quay lại website
        </button>
      </div>
    </main>
  );
}
