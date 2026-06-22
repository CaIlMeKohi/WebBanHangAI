import { useEffect, useState } from "react";
import { StaffProtectedRoute } from "../../components/StaffProtectedRoute";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

function authHeaders(): HeadersInit {
  try {
    const raw = localStorage.getItem("siteAuth") ?? localStorage.getItem("adminAuth");
    const access = raw ? (JSON.parse(raw) as { access?: string }).access : "";
    return access ? { Authorization: `Bearer ${access}` } : {};
  } catch {
    return {};
  }
}

async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail ?? `API ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

const nextStatuses: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
};

export function StaffPortal() {
  return <StaffProtectedRoute><StaffPortalContent /></StaffProtectedRoute>;
}

function StaffPortalContent() {
  const [orders, setOrders] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [filters, setFilters] = useState({ status: "", payment_method: "", from_date: "", to_date: "" });
  const [message, setMessage] = useState("");

  async function load() {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    const [nextOrders, nextReturns, nextReviews, nextLowStock] = await Promise.all([
      api(`/staff/orders?${params.toString()}`),
      api("/staff/returns"),
      api("/staff/reviews"),
      api("/staff/inventory/low-stock"),
    ]);
    setOrders(nextOrders);
    setReturns(nextReturns);
    setReviews(nextReviews);
    setLowStock(nextLowStock);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [filters.status, filters.payment_method, filters.from_date, filters.to_date]);

  async function updateOrder(orderId: number, status: string) {
    const body: Record<string, string> = { status };
    if (status === "shipped") {
      body.carrier_name = prompt("Đơn vị vận chuyển") ?? "";
      body.tracking_code = prompt("Mã vận đơn") ?? "";
    }
    await api(`/staff/orders/${orderId}/status`, { method: "PUT", body: JSON.stringify(body) });
    setMessage("Đã cập nhật đơn hàng");
    await load();
  }

  async function updateReturn(returnId: number, status: string) {
    const body: Record<string, string> = { status };
    if (status === "rejected") body.reason = prompt("Lý do từ chối") ?? "";
    await api(`/staff/returns/${returnId}/status`, { method: "PUT", body: JSON.stringify(body) });
    setMessage("Đã cập nhật yêu cầu đổi trả");
    await load();
  }

  async function updateStock(action: "import" | "adjust") {
    const variant_id = prompt("Variant ID / SKU variant");
    const change_quantity = prompt(action === "import" ? "Số lượng nhập thêm" : "Số lượng thay đổi, có thể âm");
    const reason = prompt("Lý do");
    if (!variant_id || !change_quantity || !reason) return;
    await api(`/staff/inventory/${action}`, {
      method: "POST",
      body: JSON.stringify({ variant_id, change_quantity, reason }),
    });
    setMessage(action === "import" ? "Đã nhập kho" : "Đã điều chỉnh tồn kho");
    await load();
  }

  async function moderateReview(reviewId: number, action: "approve" | "hide") {
    const reason = action === "hide" ? prompt("Lý do ẩn đánh giá") ?? "" : "";
    await api(`/staff/reviews/${reviewId}/moderate`, {
      method: "PUT",
      body: JSON.stringify({ action, reason }),
    });
    setMessage("Đã duyệt đánh giá");
    await load();
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Staff Portal</h1>
          <div className="flex gap-2">
            <button className="rounded-md border bg-white px-4 py-2" onClick={() => updateStock("import")}>Nhập kho</button>
            <button className="rounded-md bg-neutral-950 px-4 py-2 text-white" onClick={() => updateStock("adjust")}>Điều chỉnh kho</button>
          </div>
        </header>
        {message && <div className="rounded-md border bg-white p-3 text-sm">{message}</div>}

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold">Đơn hàng cần xử lý</h2>
          <div className="mb-4 grid gap-2 md:grid-cols-4">
            <select className="rounded border p-2" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">Mọi trạng thái</option><option value="pending">pending</option><option value="confirmed">confirmed</option><option value="processing">processing</option>
            </select>
            <select className="rounded border p-2" value={filters.payment_method} onChange={(event) => setFilters({ ...filters, payment_method: event.target.value })}>
              <option value="">Mọi thanh toán</option><option value="cod">COD</option><option value="vnpay">VNPay</option><option value="momo">MoMo</option><option value="bank_transfer">Bank Transfer</option>
            </select>
            <input className="rounded border p-2" type="date" value={filters.from_date} onChange={(event) => setFilters({ ...filters, from_date: event.target.value })} />
            <input className="rounded border p-2" type="date" value={filters.to_date} onChange={(event) => setFilters({ ...filters, to_date: event.target.value })} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr><th>Mã</th><th>Tổng tiền</th><th>Trạng thái</th><th>Thanh toán</th><th /></tr></thead>
              <tbody>{orders.map((order) => (
                <tr key={order.order_id} className="border-t">
                  <td>#{order.order_id}</td><td>{Number(order.final_amount).toLocaleString("vi-VN")}đ</td><td>{order.status}</td><td>{order.payment_method}</td>
                  <td className="space-x-2 py-2">{(nextStatuses[order.status] ?? []).map((status) => <button key={status} className="rounded border px-2 py-1" onClick={() => updateOrder(order.order_id, status)}>{status}</button>)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Đổi trả / khiếu nại">{returns.map((item) => <div key={item.return_id} className="rounded border p-3 text-sm"><b>#{item.return_id} - {item.status}</b><p>{item.reason}</p><div className="mt-2 space-x-2">{["approved", "rejected", "completed"].map((status) => <button key={status} className="rounded border px-2 py-1" onClick={() => updateReturn(item.return_id, status)}>{status}</button>)}</div></div>)}</Panel>
          <Panel title="Duyệt đánh giá">{reviews.map((item) => <div key={item.review_id} className="rounded border p-3 text-sm"><b>{item.product_name} - {item.rating}/5</b><p>{item.comment}</p><div className="mt-2 space-x-2"><button className="rounded border px-2 py-1" onClick={() => moderateReview(item.review_id, "approve")}>Hiển thị</button><button className="rounded border px-2 py-1" onClick={() => moderateReview(item.review_id, "hide")}>Ẩn</button></div></div>)}</Panel>
        </section>

        <Panel title="Cảnh báo tồn kho thấp"><div className="grid gap-2 md:grid-cols-3">{lowStock.map((item) => <div key={item.variant_id} className="rounded border p-3 text-sm"><b>{item.sku}</b><div>{item.color} / {item.size}</div><div>Tồn: {item.stock_quantity}</div></div>)}</div></Panel>
      </div>
    </main>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2 rounded-lg border bg-white p-4"><h2 className="mb-3 font-semibold">{title}</h2>{children}</section>;
}
