import { useNavigate, useSearchParams } from "react-router";
import { CheckCircle2 } from "lucide-react";

export function MockPaymentGateway() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = Number(params.get("orderId") ?? 0);
  const amount = Number(params.get("amount") ?? 0);
  const returnTo = params.get("returnTo") ?? "/cart";

  function confirm() {
    navigate(`${returnTo}?payment=success&orderId=${orderId}`, {
      replace: true,
    });
  }

  return (
    <main className="min-h-screen bg-emerald-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-lg border bg-white p-6 text-center shadow-sm">
        <CheckCircle2 className="mx-auto mb-4 h-14 w-14 text-emerald-600" />
        <h1 className="text-2xl font-semibold text-neutral-950">
          Da thanh toan
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Giao dich cho don #{orderId} da duoc ghi nhan tren cong thanh toan gia
          lap.
        </p>
        <div className="mt-5 rounded-md bg-neutral-50 p-4 text-sm">
          <div className="flex justify-between">
            <span>So tien</span>
            <strong>{amount.toLocaleString("vi-VN")} VND</strong>
          </div>
          <div className="mt-2 flex justify-between">
            <span>Phuong thuc</span>
            <strong>QR / Bank Transfer</strong>
          </div>
        </div>
        <button
          onClick={confirm}
          disabled={!orderId}
          className="mt-6 w-full rounded-md bg-neutral-950 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          Xac nhan va quay lai website
        </button>
      </div>
    </main>
  );
}
