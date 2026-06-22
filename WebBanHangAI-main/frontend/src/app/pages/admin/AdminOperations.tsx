import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

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
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [configs, setConfigs] = useState<RecommendationConfigRow[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [orderStatus, setOrderStatus] = useState<any[]>([]);
  const [bestProducts, setBestProducts] = useState<any[]>([]);
  const [bestBrands, setBestBrands] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [thresholdModalOpen, setThresholdModalOpen] = useState(false);
  const [thresholdValue, setThresholdValue] = useState("5");
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configKey, setConfigKey] = useState("top_n");
  const [configValue, setConfigValue] = useState('{"value":10}');

  const revenueTotal = useMemo(
    () => revenue.reduce((sum, row) => sum + Number(row.revenue ?? row.total_revenue ?? row.total_amount ?? 0), 0),
    [revenue],
  );

  async function load() {
    const [nextPaymentMethods, nextConfigs, nextLowStock, nextRevenue, nextOrderStatus, nextProducts, nextBrands, nextReco] =
      await Promise.all([
        api<PaymentMethodRow[] | { results: PaymentMethodRow[] }>("/admin/payment-methods/"),
        api<RecommendationConfigRow[] | { results: RecommendationConfigRow[] }>("/admin/recommendation-configs/"),
        api<any[]>("/admin/inventory/low-stock"),
        api<any>("/admin/reports/revenue"),
        api<any[]>("/admin/reports/order-status"),
        api<any[]>("/admin/reports/best-products"),
        api<any[]>("/admin/reports/best-brands"),
        api<any>("/admin/reports/recommendations"),
      ]);
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
    load().catch((err) => setError(err instanceof Error ? err.message : "Không tải được cài đặt"));
  }, []);

  async function togglePaymentMethod(item: PaymentMethodRow) {
    if (item.source === "payments.method") {
      setError("DB hiện tại lưu phương thức trên từng thanh toán. Cần bảng payment_methods riêng để bật/tắt.");
      return;
    }
    await api(`/admin/payment-methods/${item.method_id}/`, {
      method: "PUT",
      body: JSON.stringify({ code: item.code, name: item.name, is_active: !item.is_active, config: {} }),
    });
    await load();
  }

  async function updateThreshold(event: FormEvent) {
    event.preventDefault();
    const threshold = Number(thresholdValue);
    if (!Number.isFinite(threshold) || threshold < 0) {
      setModalError("Ngưỡng tồn kho phải là số không âm");
      return;
    }
    try {
      await api("/admin/inventory/low-stock-threshold", { method: "PUT", body: JSON.stringify({ threshold }) });
      setThresholdModalOpen(false);
      setModalError("");
      await load();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Không cập nhật được ngưỡng tồn kho");
    }
  }

  async function saveRecommendationConfig(event: FormEvent) {
    event.preventDefault();
    let config_value: unknown;
    try {
      config_value = JSON.parse(configValue);
    } catch {
      setModalError("Giá trị config phải là JSON hợp lệ");
      return;
    }
    try {
      await api("/admin/recommendation-configs/", {
        method: "POST",
        body: JSON.stringify({ config_key: configKey, config_value, description: "Cấu hình recommendation từ Admin Portal" }),
      });
      setConfigModalOpen(false);
      setModalError("");
      await load();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Không lưu được cấu hình AI");
    }
  }

  async function runRecommendations() {
    await api<{ generated: number }>("/admin/recommendations/run", { method: "POST", body: "{}" });
    await load();
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-950">Settings</h1>
            <p className="text-sm text-neutral-500">Cấu hình thanh toán, tồn kho, báo cáo và gợi ý AI.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-md border bg-white px-4 py-2" onClick={() => { setThresholdModalOpen(true); setModalError(""); }}>
              Ngưỡng tồn kho
            </button>
            <button className="rounded-md border bg-white px-4 py-2" onClick={() => { setConfigModalOpen(true); setModalError(""); }}>
              Cấu hình AI
            </button>
            <button className="rounded-md bg-neutral-950 px-4 py-2 text-white" onClick={runRecommendations}>
              Chạy gợi ý AI
            </button>
          </div>
        </header>

        {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <section className="grid gap-4 md:grid-cols-3">
          <Metric label="Doanh thu" value={`${revenueTotal.toLocaleString("vi-VN")}đ`} />
          <Metric label="CTR AI" value={`${Math.round((recommendations?.ctr ?? 0) * 100)}%`} />
          <Metric label="Tồn kho thấp" value={lowStock.length} />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
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

      {thresholdModalOpen && (
        <Modal title="Cập nhật ngưỡng tồn kho" onClose={() => setThresholdModalOpen(false)}>
          <form className="space-y-4" onSubmit={updateThreshold}>
            {modalError && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{modalError}</div>}
            <label className="block space-y-1 text-sm">
              <span>Ngưỡng tồn kho thấp</span>
              <input className="w-full rounded border px-3 py-2" type="number" min="0" value={thresholdValue} onChange={(event) => setThresholdValue(event.target.value)} />
            </label>
            <ModalActions onCancel={() => setThresholdModalOpen(false)} />
          </form>
        </Modal>
      )}

      {configModalOpen && (
        <Modal title="Cấu hình AI" onClose={() => setConfigModalOpen(false)}>
          <form className="space-y-4" onSubmit={saveRecommendationConfig}>
            {modalError && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{modalError}</div>}
            <label className="block space-y-1 text-sm">
              <span>Config key</span>
              <input className="w-full rounded border px-3 py-2" value={configKey} onChange={(event) => setConfigKey(event.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Giá trị JSON</span>
              <textarea className="min-h-28 w-full rounded border px-3 py-2 font-mono text-sm" value={configValue} onChange={(event) => setConfigValue(event.target.value)} />
            </label>
            <ModalActions onCancel={() => setConfigModalOpen(false)} />
          </form>
        </Modal>
      )}
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
            <tr key={row.id ?? row.method_id ?? row.config_id ?? row.variant_id ?? index} className="border-t">
              {columns.map((column) => <td key={column} className="max-w-[220px] truncate px-2 py-2">{formatCell(row[column])}</td>)}
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

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button className="rounded px-2 py-1 text-neutral-500 hover:bg-neutral-100" onClick={onClose}>Đóng</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" className="rounded border px-4 py-2" onClick={onCancel}>Hủy</button>
      <button type="submit" className="rounded bg-neutral-950 px-4 py-2 text-white">Lưu</button>
    </div>
  );
}

function formatCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "Bật" : "Tắt";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
