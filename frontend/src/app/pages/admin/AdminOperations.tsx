import { useEffect, useMemo, useState, type ReactNode } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

type UserRow = {
  user_id: number;
  email: string;
  phone?: string;
  role: string;
  account_status: string;
  must_change_password?: boolean;
};

type OrderRow = {
  order_id: number;
  final_amount: number;
  status: string;
  payment_status: string;
  payment_method: string;
  created_at: string;
};

type PaymentMethodRow = {
  method_id: number;
  code: string;
  name: string;
  is_active: boolean;
  source?: string;
  usage_count?: number;
};

type RecommendationConfigRow = {
  config_id: number;
  config_key: string;
  config_value: unknown;
  description: string;
};

function authHeaders(): HeadersInit {
  try {
    const raw = localStorage.getItem("siteAuth") ?? localStorage.getItem("adminAuth");
    const access = raw ? (JSON.parse(raw) as { access?: string }).access : "";
    return access ? { Authorization: `Bearer ${access}` } : {};
  } catch {
    return {};
  }
}

async function api<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail ?? `API ${response.status}`);
  }
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

function asArray<T>(value: T[] | { results?: T[] } | { revenue?: T[] } | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value && "results" in value && Array.isArray(value.results)) return value.results;
  if (value && "revenue" in value && Array.isArray(value.revenue)) return value.revenue;
  return [];
}

export function AdminOperations() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [configs, setConfigs] = useState<RecommendationConfigRow[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [orderStatus, setOrderStatus] = useState<any[]>([]);
  const [bestProducts, setBestProducts] = useState<any[]>([]);
  const [bestBrands, setBestBrands] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any | null>(null);
  const [message, setMessage] = useState("");

  const revenueTotal = useMemo(
    () => revenue.reduce((sum, row) => sum + Number(row.revenue ?? row.total_revenue ?? row.total_amount ?? 0), 0),
    [revenue],
  );

  async function load() {
    const [nextUsers, nextOrders, nextPaymentMethods, nextConfigs, nextLowStock, nextRevenue, nextOrderStatus, nextProducts, nextBrands, nextReco] =
      await Promise.all([
        api<UserRow[] | { results: UserRow[] }>("/admin/users/"),
        api<OrderRow[]>("/admin/orders"),
        api<PaymentMethodRow[] | { results: PaymentMethodRow[] }>("/admin/payment-methods/"),
        api<RecommendationConfigRow[] | { results: RecommendationConfigRow[] }>("/admin/recommendation-configs/"),
        api<any[]>("/admin/inventory/low-stock"),
        api<any>("/admin/reports/revenue"),
        api<any[]>("/admin/reports/order-status"),
        api<any[]>("/admin/reports/best-products"),
        api<any[]>("/admin/reports/best-brands"),
        api<any>("/admin/reports/recommendations"),
      ]);
    setUsers(asArray(nextUsers));
    setOrders(asArray(nextOrders));
    setPaymentMethods(asArray(nextPaymentMethods));
    setConfigs(asArray(nextConfigs));
    setLowStock(asArray(nextLowStock));
    setRevenue(asArray(nextRevenue));
    setOrderStatus(asArray(nextOrderStatus));
    setBestProducts(asArray(nextProducts));
    setBestBrands(asArray(nextBrands));
    setRecommendations(nextReco);
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, []);

  async function createStaff() {
    const email = prompt("Email nhân viên/admin");
    const password = prompt("Mật khẩu tạm thời tối thiểu 12 ký tự");
    const role = prompt("Role: staff hoặc admin", "staff") ?? "staff";
    if (!email || !password) return;
    await api("/admin/staffs", { method: "POST", body: JSON.stringify({ email, password, role, full_name: email }) });
    setMessage("Đã tạo tài khoản");
    await load();
  }

  async function toggleUser(userId: number, locked: boolean) {
    await api(`/admin/users/${userId}/${locked ? "unlock" : "lock"}`, { method: "PUT", body: "{}" });
    setMessage(locked ? "Đã mở khóa tài khoản" : "Đã khóa tài khoản");
    await load();
  }

  async function updateOrderStatus(order: OrderRow) {
    const status = prompt("Trạng thái mới: confirmed, processing, shipped, delivered, cancelled", order.status);
    if (!status || status === order.status) return;
    const body: Record<string, string> = { status };
    if (status === "shipped") {
      body.carrier_name = prompt("Đơn vị vận chuyển") ?? "";
      body.tracking_code = prompt("Mã vận đơn") ?? "";
    }
    await api(`/admin/orders/${order.order_id}/status`, { method: "PUT", body: JSON.stringify(body) });
    setMessage("Đã cập nhật đơn hàng");
    await load();
  }

  async function togglePaymentMethod(item: PaymentMethodRow) {
    if (item.source === "payments.method") {
      setMessage("DB hiện tại lưu method trên từng payment. Muốn bật/tắt riêng cần thêm bảng payment_methods.");
      return;
    }
    await api(`/admin/payment-methods/${item.method_id}/`, {
      method: "PUT",
      body: JSON.stringify({ code: item.code, name: item.name, is_active: !item.is_active, config: {} }),
    });
    setMessage("Đã cập nhật phương thức thanh toán");
    await load();
  }

  async function updateThreshold() {
    const threshold = Number(prompt("Ngưỡng tồn kho thấp mới", "5"));
    if (!Number.isFinite(threshold) || threshold < 0) return;
    await api("/admin/inventory/low-stock-threshold", { method: "PUT", body: JSON.stringify({ threshold }) });
    setMessage("Đã cập nhật ngưỡng tồn kho thấp");
    await load();
  }

  async function saveRecommendationConfig() {
    const config_key = prompt("Key cấu hình", "top_n");
    const rawValue = prompt("Giá trị JSON", '{"value":10}');
    if (!config_key || !rawValue) return;
    let config_value: unknown;
    try {
      config_value = JSON.parse(rawValue);
    } catch {
      setMessage("Giá trị config phải là JSON hợp lệ");
      return;
    }
    await api("/admin/recommendation-configs/", {
      method: "POST",
      body: JSON.stringify({ config_key, config_value, description: "Cấu hình recommendation từ Admin Portal" }),
    });
    setMessage("Đã lưu cấu hình recommendation");
    await load();
  }

  async function runRecommendations() {
    const result = await api<{ generated: number }>("/admin/recommendations/run", { method: "POST", body: "{}" });
    setMessage(`Đã tạo ${result.generated} gợi ý`);
    await load();
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-950">Admin Operations</h1>
            <p className="text-sm text-neutral-500">Quản lý tài khoản, đơn hàng, thanh toán, tồn kho, báo cáo và gợi ý AI.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border bg-white px-4 py-2" onClick={createStaff}>Tạo nhân viên</button>
            <button className="rounded-md border bg-white px-4 py-2" onClick={updateThreshold}>Ngưỡng tồn kho</button>
            <button className="rounded-md border bg-white px-4 py-2" onClick={saveRecommendationConfig}>Cấu hình AI</button>
            <button className="rounded-md bg-neutral-950 px-4 py-2 text-white" onClick={runRecommendations}>Chạy gợi ý AI</button>
          </div>
        </header>

        {message && <div className="rounded-md border bg-white p-3 text-sm text-neutral-700">{message}</div>}

        <section className="grid gap-4 md:grid-cols-5">
          <Metric label="Tài khoản" value={users.length} />
          <Metric label="Đơn hàng" value={orders.length} />
          <Metric label="Doanh thu" value={`${revenueTotal.toLocaleString("vi-VN")}d`} />
          <Metric label="CTR AI" value={`${Math.round((recommendations?.ctr ?? 0) * 100)}%`} />
          <Metric label="Tồn kho thấp" value={lowStock.length} />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Panel title="Tài khoản">
            <DataTable rows={users} columns={["user_id", "email", "role", "account_status"]} action={(user) => (
              <button className="rounded border px-2 py-1" onClick={() => toggleUser(user.user_id, user.account_status === "locked")}>
                {user.account_status === "locked" ? "Mở khóa" : "Khóa"}
              </button>
            )} />
          </Panel>

          <Panel title="Đơn hàng">
            <DataTable rows={orders} columns={["order_id", "status", "payment_status", "payment_method", "final_amount"]} action={(order) => (
              <button className="rounded border px-2 py-1" onClick={() => updateOrderStatus(order)}>Cập nhật</button>
            )} />
          </Panel>

          <Panel title="Phương thức thanh toán">
            <DataTable rows={paymentMethods} columns={["code", "name", "is_active", "usage_count"]} action={(item) => (
              <button className="rounded border px-2 py-1" onClick={() => togglePaymentMethod(item)}>
                {item.source === "payments.method" ? "Xem" : item.is_active ? "Ẩn" : "Bật"}
              </button>
            )} />
          </Panel>

          <Panel title="Cấu hình Recommendation">
            <DataTable rows={configs} columns={["config_key", "config_value", "description"]} />
          </Panel>
        </section>

        <section className="grid gap-4 lg:grid-cols-4">
          <ReportBlock title="Doanh thu" rows={revenue} />
          <ReportBlock title="Trạng thái đơn" rows={orderStatus} />
          <ReportBlock title="Sản phẩm bán chạy" rows={bestProducts} />
          <ReportBlock title="Brand bán chạy" rows={bestBrands} />
        </section>

        <Panel title="Cảnh báo tồn kho thấp">
          <DataTable rows={lowStock} columns={["variant_id", "sku", "product_name", "stock_quantity", "low_stock_threshold"]} />
        </Panel>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function DataTable<T extends Record<string, any>>({
  rows,
  columns,
  action,
}: {
  rows: T[];
  columns: string[];
  action?: (row: T) => ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map((column) => <th key={column} className="px-2 py-2 text-neutral-500">{column}</th>)}
            {action && <th className="px-2 py-2" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? row.user_id ?? row.order_id ?? row.method_id ?? row.config_id ?? row.variant_id ?? index} className="border-t">
              {columns.map((column) => (
                <td key={column} className="max-w-[220px] truncate px-2 py-2">
                  {formatCell(row[column])}
                </td>
              ))}
              {action && <td className="px-2 py-2 text-right">{action(row)}</td>}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="px-2 py-4 text-neutral-500" colSpan={columns.length + (action ? 1 : 0)}>Chưa có dữ liệu</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ReportBlock({ title, rows }: { title: string; rows: any[] }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="space-y-2 text-sm">
        {rows.slice(0, 8).map((row, index) => (
          <div key={index} className="rounded border p-2">
            {Object.entries(row).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <span className="text-neutral-500">{key}</span>
                <span className="truncate font-medium">{formatCell(value)}</span>
              </div>
            ))}
          </div>
        ))}
        {!rows.length && <div className="text-neutral-500">Chưa có dữ liệu</div>}
      </div>
    </div>
  );
}

function formatCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Bật" : "Tắt";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
