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
    <main className="min-h-screen bg-neutral-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-lg border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <QrCode className="h-6 w-6 text-neutral-900" />
          <h1 className="text-xl font-semibold text-neutral-950">Quet ma thanh toan</h1>
        </div>

        <div className="rounded-md border bg-neutral-50 p-4 text-center">
          <img src={qrUrl} alt="Ma QR thanh toan" className="mx-auto h-64 w-64" />
        </div>

        <div className="mt-5 space-y-2 text-sm text-neutral-700">
          <div className="flex justify-between gap-3">
            <span>Ma don</span>
            <strong>#{orderId}</strong>
          </div>
          <div className="flex justify-between gap-3">
            <span>So tien</span>
            <strong>{amount.toLocaleString("vi-VN")} VND</strong>
          </div>
        </div>

        <a
          href={gatewayUrl}
          className="mt-6 block w-full rounded-md bg-neutral-950 px-4 py-3 text-center font-medium text-white"
        >
          Mo trang thanh toan
        </a>

        <Link to={returnTo} className="mt-4 inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-950">
          <ArrowLeft className="h-4 w-4" />
          Quay lai
        </Link>
      </div>
    </main>
  );
}
