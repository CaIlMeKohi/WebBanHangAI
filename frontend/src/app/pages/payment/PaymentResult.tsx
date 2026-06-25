import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, QrCode, Truck, XCircle } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router";

import {
  fetchPaymentStatus,
  reorderAsCOD,
  switchPaymentToCOD,
  type PaymentStatus,
} from "../../lib/api";

export function PaymentResult() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const orderId = Number(params.get("orderCode") ?? 0);
  const [payment, setPayment] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(orderId));
  const [actionLoading, setActionLoading] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!orderId) return;
    let stopped = false;
    let timer: number | undefined;

    async function refresh() {
      try {
        const next = await fetchPaymentStatus(orderId);
        if (stopped) return;
        setPayment(next);
        setError("");
        setLoading(false);
        if (next.payment_status === "pending" && next.order_status === "pending") {
          timer = window.setTimeout(refresh, 3000);
        }
      } catch (err) {
        if (stopped) return;
        setError(err instanceof Error ? err.message : "Không thể kiểm tra trạng thái thanh toán.");
        setLoading(false);
      }
    }

    void refresh();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [orderId]);

  const secondsLeft = useMemo(() => {
    if (!payment?.expires_at) return 0;
    return Math.max(0, Math.ceil((new Date(payment.expires_at).getTime() - now) / 1000));
  }, [payment?.expires_at, now]);

  async function switchToCOD() {
    if (!orderId || !confirm("Đổi đơn hàng này sang thanh toán khi nhận hàng?")) return;
    setActionLoading(true);
    setError("");
    try {
      setPayment(await switchPaymentToCOD(orderId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đổi sang COD.");
    } finally {
      setActionLoading(false);
    }
  }

  async function reorderCOD() {
    if (!orderId) return;
    setActionLoading(true);
    setError("");
    try {
      const order = await reorderAsCOD(orderId);
      navigate(`/profile?tab=orders&orderId=${order.order_id}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể đặt lại. Tồn kho, giá hoặc coupon có thể đã thay đổi.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  if (!orderId) {
    return (
      <ResultCard
        state="cancelled"
        title="Thiếu mã đơn hàng"
        message="Liên kết trả về từ payOS không hợp lệ."
      />
    );
  }

  if (loading) {
    return (
      <ResultCard
        state="pending"
        title="Đang xác minh thanh toán"
        message={`Đang kiểm tra đơn #${orderId}...`}
      />
    );
  }

  if (payment?.payment_status === "paid") {
    return (
      <ResultCard
        state="paid"
        title="Thanh toán thành công"
        message={`Đơn #${orderId} đã được payOS xác nhận thanh toán.`}
      />
    );
  }

  if (payment?.payment_method === "cod" && payment.order_status !== "cancelled") {
    return (
      <ResultCard
        state="cod"
        title="Đã đổi sang COD"
        message={`Đơn #${orderId} sẽ được thanh toán khi nhận hàng.`}
      />
    );
  }

  if (payment?.order_status === "cancelled") {
    return (
      <ResultCard
        state="cancelled"
        title="Đơn hàng đã hết hạn"
        message="Đơn đã được hủy và hàng đã hoàn lại kho. Khi đặt lại, hệ thống sẽ kiểm tra tồn kho, giá và coupon hiện tại."
      >
        {error && <ErrorBox message={error} />}
        <button
          onClick={() => void reorderCOD()}
          disabled={actionLoading || !payment.can_reorder_cod}
          className="mt-5 w-full rounded-xl bg-neutral-950 px-4 py-3 font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-950"
        >
          {actionLoading ? "Đang kiểm tra..." : "Đặt lại bằng COD"}
        </button>
      </ResultCard>
    );
  }

  return (
    <ResultCard
      state="pending"
      title="Đang chờ thanh toán"
      message={`Đơn #${orderId} còn ${formatCountdown(secondsLeft)} để hoàn tất thanh toán.`}
    >
      {error && <ErrorBox message={error} />}
      <div className="mt-5 grid gap-3">
        {payment?.checkout_url && (
          <a
            href={payment.checkout_url}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 font-medium text-white hover:bg-sky-700"
          >
            <QrCode className="h-5 w-5" />
            Tiếp tục quét QR
          </a>
        )}
        <button
          onClick={() => void switchToCOD()}
          disabled={actionLoading || !payment?.can_switch_to_cod}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-4 py-3 font-medium disabled:opacity-50 dark:border-neutral-700"
        >
          <Truck className="h-5 w-5" />
          {actionLoading ? "Đang chuyển..." : "Đổi sang thanh toán COD"}
        </button>
      </div>
    </ResultCard>
  );
}

function ResultCard({
  state,
  title,
  message,
  children,
}: {
  state: "paid" | "cancelled" | "pending" | "cod";
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  const Icon =
    state === "paid" ? CheckCircle2 : state === "cancelled" ? XCircle : state === "cod" ? Truck : Clock3;
  const color =
    state === "paid"
      ? "text-emerald-600"
      : state === "cancelled"
        ? "text-red-500"
        : state === "cod"
          ? "text-sky-600"
          : "text-amber-500";

  return (
    <main className="min-h-[70vh] bg-white px-4 py-16 text-neutral-950 dark:bg-neutral-950 dark:text-white">
      <div className="mx-auto max-w-md rounded-2xl border border-neutral-200 bg-white p-7 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <Icon className={`mx-auto mb-4 h-16 w-16 ${color}`} />
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{message}</p>
        {children}
        <Link
          to="/profile?tab=orders"
          className="mt-4 block w-full rounded-xl border border-neutral-300 px-4 py-3 font-medium dark:border-neutral-700"
        >
          Xem đơn hàng
        </Link>
      </div>
    </main>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</div>;
}

function formatCountdown(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
