import { Link, useSearchParams } from "react-router";
import { ArrowLeft, QrCode } from "lucide-react";

export function PaymentQr() {
  const [params] = useSearchParams();
  const orderId = params.get("orderId") ?? "";
  const amount = Number(params.get("amount") ?? 0);
  const returnTo = params.get("returnTo") ?? "/cart";
  const gatewayUrl = `${window.location.origin}/payment-gateway?orderId=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(String(amount))}&returnTo=${encodeURIComponent(returnTo)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(gatewayUrl)}`;

  return (
    <main className="min-h-screen bg-white px-4 py-10 text-neutral-950 transition-colors dark:bg-neutral-950 dark:text-white">
      <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mb-6 flex items-center gap-3">
          <QrCode className="h-6 w-6 text-neutral-900 dark:text-white" />
          <h1 className="text-xl font-semibold text-neutral-950 dark:text-white">Quét mã thanh toán</h1>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-center dark:border-neutral-800 dark:bg-neutral-800">
          <img src={qrUrl} alt="Mã QR thanh toán" className="mx-auto h-64 w-64" />
        </div>

        <div className="mt-5 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
          <div className="flex justify-between gap-3">
            <span>Mã đơn</span>
            <strong>#{orderId}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span>Số tiền</span>
            <strong>{amount.toLocaleString("vi-VN")} VND</strong>
          </div>
        </div>

        <a
          href={gatewayUrl}
          className="mt-6 block w-full rounded-xl bg-neutral-950 px-4 py-3 text-center font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200"
        >
          Mở trang thanh toán
        </a>

        <Link
          to={returnTo}
          className="mt-4 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-950 dark:text-neutral-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </Link>
      </div>
    </main>
  );
}
