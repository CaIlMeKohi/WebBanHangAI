import { useEffect, useState } from "react";

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

export function StaffPortal() {
  const [orders, setOrders] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    const [nextOrders, nextReturns, nextLowStock] = await Promise.all([
      api("/products/staff/orders/"),
      api("/staff/returns"),
      api("/products/staff/inventory/low-stock/"),
    ]);
    setOrders(nextOrders);
    setReturns(nextReturns);
    setLowStock(nextLowStock);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  async function updateOrder(orderId: number, status: string) {
    const body: Record<string, string> = { status };
    if (status === "shipped") {
      body.carrier_name = prompt("Don vi van chuyen") ?? "";
      body.tracking_code = prompt("Ma van don") ?? "";
    }
    await api(`/staff/orders/${orderId}/status`, { method: "PUT", body: JSON.stringify(body) });
    setMessage("Da cap nhat don hang");
    await load();
  }

  async function updateReturn(returnId: number, status: string) {
    const body: Record<string, string> = { status };
    if (status === "rejected") body.reason = prompt("Ly do tu choi") ?? "";
    await api(`/staff/returns/${returnId}/status`, { method: "PUT", body: JSON.stringify(body) });
    setMessage("Da cap nhat yeu cau doi tra");
    await load();
  }

  async function adjustStock() {
    const variant_id = prompt("Variant ID");
    const change_quantity = prompt("So luong thay doi");
    const reason = prompt("Ly do dieu chinh");
    if (!variant_id || !change_quantity || !reason) return;
    await api("/products/staff/inventory/adjust/", {
      method: "POST",
      body: JSON.stringify({ variant_id, change_quantity, reason }),
    });
    setMessage("Da dieu chinh ton kho");
    await load();
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-950">Staff Portal</h1>
          <button className="rounded-md bg-neutral-950 px-4 py-2 text-white" onClick={adjustStock}>
            Dieu chinh kho
          </button>
        </header>
        {message && <div className="rounded-md border bg-white p-3 text-sm text-neutral-700">{message}</div>}

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold">Don hang can xu ly</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr><th>Ma</th><th>Tong tien</th><th>Trang thai</th><th>Thanh toan</th><th></th></tr></thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.order_id} className="border-t">
                    <td>#{order.order_id}</td>
                    <td>{order.final_amount?.toLocaleString("vi-VN")}</td>
                    <td>{order.status}</td>
                    <td>{order.payment_method}</td>
                    <td className="space-x-2 py-2">
                      {["confirmed", "processing", "shipped", "delivered", "cancelled"].map((status) => (
                        <button key={status} className="rounded border px-2 py-1" onClick={() => updateOrder(order.order_id, status)}>
                          {status}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold">Doi tra / khieu nai</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {returns.map((item) => (
              <div key={item.return_id} className="rounded-md border p-3 text-sm">
                <div className="font-medium">Yeu cau #{item.return_id} - {item.status}</div>
                <p className="mt-1 text-neutral-600">{item.reason}</p>
                <div className="mt-3 space-x-2">
                  {["approved", "rejected", "completed"].map((status) => (
                    <button key={status} className="rounded border px-2 py-1" onClick={() => updateReturn(item.return_id, status)}>
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold">Canh bao ton kho thap</h2>
          <div className="grid gap-2 md:grid-cols-3">
            {lowStock.map((variant) => (
              <div key={variant.variant_id} className="rounded-md border p-3 text-sm">
                <div className="font-medium">{variant.sku}</div>
                <div>{variant.color} / {variant.size}</div>
                <div>Ton: {variant.stock_quantity}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
