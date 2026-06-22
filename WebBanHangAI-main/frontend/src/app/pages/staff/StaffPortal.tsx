import { useEffect, useState } from "react";
import { Link } from "react-router";
import { StaffProtectedRoute } from "../../components/StaffProtectedRoute";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { usePortalLightTheme } from "../../lib/usePortalLightTheme";

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

type OrderStatus = "pending" | "confirmed" | "processing" | "waiting_pickup" | "shipped" | "delivered" | "completed" | "cancelled";

type StaffOrder = {
  order_id: number;
  customer?: {
    full_name?: string;
    email?: string;
    phone?: string;
    customer_code?: string;
  };
  shipping_address?: {
    receiver_name?: string;
    receiver_phone?: string;
    address_line?: string;
    ward?: string;
    district?: string;
    province?: string;
  };
  final_amount: number | string;
  status: OrderStatus;
  payment_method: string;
  payment_status?: string;
  items?: Array<{
    order_item_id: number;
    product?: { name?: string; image?: string };
    product_name_snapshot?: string;
    brand_name_snapshot?: string;
    category_name_snapshot?: string;
    sku_snapshot?: string;
    color_snapshot?: string;
    size_snapshot?: string;
    quantity: number;
    price: number | string;
    subtotal?: number | string;
  }>;
};

type StockAction = "import" | "adjust";

type StockForm = {
  variant_id: string;
  size_id: string;
  change_quantity: string;
  reason: string;
  note: string;
};

type ShipmentForm = {
  carrier_name: string;
  tracking_code: string;
  note: string;
};

type StockVariantOption = {
  variant_id: number | string;
  sku?: string;
  product_name?: string;
  product?: { name?: string };
  color?: string;
  size?: string;
  stock_quantity?: number | string;
  available_stock?: number | string;
};

const nextStatuses: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["waiting_pickup", "cancelled"],
  waiting_pickup: ["shipped"],
  shipped: ["delivered"],
  delivered: ["completed"],
  completed: [],
  cancelled: [],
};

const statusLabels: Record<OrderStatus, string> = {
  pending: "Chờ xử lý",
  confirmed: "Xác nhận",
  processing: "Đang xử lý",
  waiting_pickup: "Chờ lấy hàng",
  shipped: "Đang giao",
  delivered: "Đã giao hàng",
  completed: "Hoàn thành",
  cancelled: "Đã hủy",
};

const actionLabels: Record<OrderStatus, string> = {
  pending: "Chờ xử lý",
  confirmed: "Xác nhận",
  processing: "Đang xử lý",
  waiting_pickup: "Giao hàng",
  shipped: "Đang giao",
  delivered: "Đã giao hàng",
  completed: "Hoàn thành",
  cancelled: "Hủy đơn",
};

function generateTrackingCode(orderId: number) {
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `BKQ${datePart}${String(orderId).padStart(5, "0")}${randomPart}`;
}

function authHeaders(): HeadersInit {
  try {
    const access = ["siteAuth", "adminAuth"]
      .map((key) => localStorage.getItem(key))
      .map((raw) => {
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw) as { access?: unknown };
          return typeof parsed.access === "string" && parsed.access.trim()
            ? parsed.access.trim()
            : null;
        } catch {
          return null;
        }
      })
      .find((token): token is string => Boolean(token));
    return access ? { Authorization: `Bearer ${access}` } : {};
  } catch {
    return {};
  }
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeaders(), ...(options.headers ?? {}) },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem("siteAuth");
      localStorage.removeItem("adminAuth");
    }
    throw new Error(data.detail ?? `API ${response.status}`);
  }
  if (response.status === 204) return null as T;
  return response.json() as Promise<T>;
}

export function StaffPortal() {
  usePortalLightTheme();
  return (
    <StaffProtectedRoute>
      <StaffPortalContent />
    </StaffProtectedRoute>
  );
}

function StaffPortalContent() {
  const { logout } = useAdminAuth();
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [stockVariants, setStockVariants] = useState<StockVariantOption[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<StaffOrder | null>(null);
  const [filters, setFilters] = useState({ status: "", payment_method: "", from_date: "", to_date: "" });
  const [message, setMessage] = useState("");
  const [stockModal, setStockModal] = useState<StockAction | null>(null);
  const [stockForm, setStockForm] = useState<StockForm>({ variant_id: "", size_id: "", change_quantity: "", reason: "", note: "" });
  const [stockError, setStockError] = useState("");
  const [isSavingStock, setIsSavingStock] = useState(false);
  const [shipmentOrder, setShipmentOrder] = useState<StaffOrder | null>(null);
  const [shipmentForm, setShipmentForm] = useState<ShipmentForm>({ carrier_name: "", tracking_code: "", note: "" });
  const [shipmentError, setShipmentError] = useState("");
  const [isSavingShipment, setIsSavingShipment] = useState(false);

  async function load() {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
    try {
      const [nextOrders, nextReturns, nextLowStock, nextStockVariants] = await Promise.all([
        api<StaffOrder[]>(`/staff/orders?${params.toString()}`),
        api<any[]>("/staff/returns"),
        api<any[]>("/staff/inventory/low-stock"),
        api<StockVariantOption[]>("/staff/inventory/variants"),
      ]);
      setOrders(nextOrders);
      setReturns(nextReturns);
      setLowStock(nextLowStock);
      setStockVariants(nextStockVariants);
      setSelectedOrder((current) => nextOrders.find((order) => order.order_id === current?.order_id) ?? current);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Token")) {
        logout();
      }
      throw error;
    }
  }

  useEffect(() => {
    load().catch((error) => setMessage(error.message));
  }, [filters.status, filters.payment_method, filters.from_date, filters.to_date]);

  async function updateOrder(orderId: number, status: OrderStatus) {
    if (status === "waiting_pickup") {
      const order = orders.find((item) => item.order_id === orderId) ?? null;
      setShipmentOrder(order);
      setShipmentForm({ carrier_name: "Giao hàng nhanh", tracking_code: generateTrackingCode(orderId), note: "" });
      setShipmentError("");
      return;
    }
    try {
      const body: Record<string, string> = { status };
      await api(`/staff/orders/${orderId}/status`, { method: "PUT", body: JSON.stringify(body) });
      setMessage(status === "cancelled" ? "Đã hủy đơn hàng" : "Đã cập nhật đơn hàng");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể cập nhật đơn hàng");
    }
  }

  async function submitShipmentForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shipmentOrder) return;

    const carrierName = shipmentForm.carrier_name.trim();
    if (!carrierName) {
      setShipmentError("Vui lòng chọn hoặc nhập đơn vị vận chuyển.");
      return;
    }
    if (carrierName === "__other__") {
      setShipmentError("Vui lòng nhập tên đơn vị vận chuyển khác.");
      return;
    }

    setIsSavingShipment(true);
    setShipmentError("");
    try {
      await api(`/staff/orders/${shipmentOrder.order_id}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status: "waiting_pickup",
          carrier_name: carrierName,
          tracking_code: shipmentForm.tracking_code.trim(),
          note: shipmentForm.note.trim(),
        }),
      });
      setShipmentOrder(null);
      setShipmentForm({ carrier_name: "", tracking_code: "", note: "" });
      setMessage("Đã cập nhật giao hàng");
      await load();
    } catch (error) {
      setShipmentError(error instanceof Error ? error.message : "Không thể cập nhật giao hàng.");
    } finally {
      setIsSavingShipment(false);
    }
  }

  async function updateReturn(returnId: number, status: string) {
    const body: Record<string, string> = { status };
    if (status === "rejected") body.reason = prompt("Lý do từ chối") ?? "";
    await api(`/staff/returns/${returnId}/status`, { method: "PUT", body: JSON.stringify(body) });
    setMessage("Đã cập nhật yêu cầu đổi trả");
    await load();
  }

  function openStockModal(action: StockAction) {
    setStockModal(action);
    setStockForm({
      variant_id: "",
      size_id: "",
      change_quantity: "",
      reason: action === "import" ? "Nhập hàng mới" : "Điều chỉnh sau kiểm kê",
      note: "",
    });
    setStockError("");
  }

  async function submitStockForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stockModal) return;

    const variantId = stockForm.variant_id.trim();
    const quantity = Number(stockForm.change_quantity);
    const baseReason = stockForm.reason.trim();
    const note = stockForm.note.trim();
    const reason = note ? `${baseReason} - Ghi chú: ${note}` : baseReason;

    if (!variantId || !stockForm.change_quantity.trim() || !reason) {
      setStockError("Vui lòng nhập đầy đủ Variant ID, số lượng và lý do.");
      return;
    }
    if (!Number.isFinite(quantity) || !Number.isInteger(quantity)) {
      setStockError("Số lượng phải là số nguyên.");
      return;
    }
    if (stockModal === "import" && quantity <= 0) {
      setStockError("Số lượng nhập kho phải lớn hơn 0.");
      return;
    }
    if (stockModal === "adjust" && quantity === 0) {
      setStockError("Số lượng điều chỉnh phải khác 0.");
      return;
    }

    setIsSavingStock(true);
    setStockError("");
    try {
      await api(`/staff/inventory/${stockModal}`, {
        method: "POST",
        body: JSON.stringify({ variant_id: variantId, change_quantity: quantity, reason }),
      });
      setStockModal(null);
      setStockForm({ variant_id: "", size_id: "", change_quantity: "", reason: "", note: "" });
      await load();
    } catch (error) {
      setStockError(error instanceof Error ? error.message : "Không thể cập nhật tồn kho.");
    } finally {
      setIsSavingStock(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Cổng nhân viên</h1>
          <div className="flex gap-2">
            <Link className="rounded-md border bg-white px-4 py-2" to="/">Trang chủ</Link>
            <button className="rounded-md border bg-white px-4 py-2" onClick={() => openStockModal("import")}>Nhập kho</button>
            <button className="rounded-md bg-neutral-950 px-4 py-2 text-white" onClick={() => openStockModal("adjust")}>Điều chỉnh kho</button>
            <button className="rounded-md border border-red-200 bg-white px-4 py-2 text-red-700" onClick={logout}>Đăng xuất</button>
          </div>
        </header>

        {message && <div className="rounded-md border bg-white p-3 text-sm">{message}</div>}

        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 font-semibold">Đơn hàng cần xử lý</h2>
          <div className="mb-4 grid gap-2 md:grid-cols-4">
            <select className="rounded border p-2" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">Mọi trạng thái</option>
              <option value="pending">Chờ xử lý</option>
              <option value="confirmed">Xác nhận</option>
              <option value="processing">Đang xử lý</option>
              <option value="waiting_pickup">Chờ lấy hàng</option>
              <option value="shipped">Đang giao</option>
              <option value="delivered">Đã giao hàng</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Đã hủy</option>
            </select>
            <select className="rounded border p-2" value={filters.payment_method} onChange={(event) => setFilters({ ...filters, payment_method: event.target.value })}>
              <option value="">Mọi thanh toán</option>
              <option value="cod">COD</option>
              <option value="vnpay">VNPay</option>
              <option value="momo">MoMo</option>
              <option value="bank_transfer">Chuyển khoản</option>
            </select>
            <input className="rounded border p-2" type="date" value={filters.from_date} onChange={(event) => setFilters({ ...filters, from_date: event.target.value })} />
            <input className="rounded border p-2" type="date" value={filters.to_date} onChange={(event) => setFilters({ ...filters, to_date: event.target.value })} />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="px-2 py-2">Mã</th>
                  <th className="px-2 py-2">Tổng tiền</th>
                  <th className="px-2 py-2">Trạng thái</th>
                  <th className="px-2 py-2">Thanh toán</th>
                  <th className="px-2 py-2">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.order_id} className="border-t">
                    <td className="px-2 py-3">#{order.order_id}</td>
                    <td className="px-2 py-3">{Number(order.final_amount).toLocaleString("vi-VN")}đ</td>
                    <td className="px-2 py-3">{statusLabels[order.status] ?? order.status}</td>
                    <td className="px-2 py-3">{order.payment_method}</td>
                    <td className="space-x-2 px-2 py-3">
                      <button className="rounded border px-2 py-1" onClick={() => setSelectedOrder(order)}>Chi tiết sản phẩm</button>
                      {(nextStatuses[order.status] ?? []).map((status) => (
                        <button key={status} className="rounded border px-2 py-1" onClick={() => updateOrder(order.order_id, status)}>
                          {actionLabels[status] ?? status}
                        </button>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {selectedOrder && <OrderDetailPanel order={selectedOrder} onClose={() => setSelectedOrder(null)} />}

        <section className="grid gap-4">
          <Panel title="Đổi trả / khiếu nại">
            {returns.map((item) => (
              <div key={item.return_id} className="rounded border p-3 text-sm">
                <b>#{item.return_id} - {item.status}</b>
                <p>{item.reason}</p>
                <div className="mt-2 space-x-2">
                  {["approved", "rejected", "completed"].map((status) => (
                    <button key={status} className="rounded border px-2 py-1" onClick={() => updateReturn(item.return_id, status)}>{status}</button>
                  ))}
                </div>
              </div>
            ))}
          </Panel>
        </section>

        <Panel title="Cảnh báo tồn kho thấp">
          <div className="grid gap-2 md:grid-cols-3">
            {lowStock.map((item) => (
              <div key={item.variant_id} className="rounded border p-3 text-sm">
                <b>{item.sku}</b>
                <div>{item.color} / {item.size}</div>
                <div>Tồn: {item.stock_quantity}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {stockModal && (
        <StockModal
          action={stockModal}
          form={stockForm}
          variants={stockVariants.length ? stockVariants : lowStock}
          error={stockError}
          isSaving={isSavingStock}
          onChange={setStockForm}
          onClose={() => {
            if (isSavingStock) return;
            setStockModal(null);
            setStockError("");
          }}
          onSubmit={submitStockForm}
        />
      )}

      {shipmentOrder && (
        <ShipmentModal
          order={shipmentOrder}
          form={shipmentForm}
          error={shipmentError}
          isSaving={isSavingShipment}
          onChange={setShipmentForm}
          onClose={() => {
            if (isSavingShipment) return;
            setShipmentOrder(null);
            setShipmentError("");
          }}
          onSubmit={submitShipmentForm}
        />
      )}
    </main>
  );
}

function StockModal({
  action,
  form,
  variants,
  error,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: {
  action: StockAction;
  form: StockForm;
  variants: StockVariantOption[];
  error: string;
  isSaving: boolean;
  onChange: (form: StockForm) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [variantSearch, setVariantSearch] = useState("");
  const [isVariantListOpen, setIsVariantListOpen] = useState(false);
  const [selectedProductName, setSelectedProductName] = useState("");
  const title = action === "import" ? "Nhập kho" : "Điều chỉnh kho";
  const selectedVariant = variants.find((variant) => String(variant.variant_id) === form.variant_id);
  const currentStock = selectedVariant
    ? Number(selectedVariant.stock_quantity ?? selectedVariant.available_stock ?? 0)
    : 0;
  const quantity = Number(form.change_quantity || 0);
  const stockAfterImport = currentStock + (Number.isFinite(quantity) ? quantity : 0);
  const productOptions = getUniqueProductOptions(variants);
  const filteredProducts = productOptions.filter((product) =>
    product.label.toLowerCase().includes(variantSearch.trim().toLowerCase()),
  );
  const sizeOptions = variants.filter((variant) => getVariantProductName(variant) === selectedProductName);
  const applyVariantSearch = (value: string) => {
    setVariantSearch(value);
    setIsVariantListOpen(true);
    setSelectedProductName("");
    onChange({ ...form, variant_id: "", size_id: "" });
  };
  const selectProduct = (productName: string) => {
    setSelectedProductName(productName);
    setVariantSearch(productName);
    setIsVariantListOpen(false);
    onChange({ ...form, variant_id: "", size_id: "" });
  };
  const selectSize = (variantId: string) => {
    const variant = variants.find((item) => String(item.variant_id) === variantId);
    onChange({ ...form, size_id: variantId, variant_id: variantId });
    if (variant) {
      setSelectedProductName(getVariantProductName(variant));
      setVariantSearch(getVariantProductName(variant));
    }
  };

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-xl rounded-lg bg-white p-5 shadow-xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button className="rounded border px-3 py-1 text-sm" onClick={onClose} disabled={isSaving}>
              Đóng
            </button>
          </div>

          <form className="space-y-4" onSubmit={onSubmit}>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Sản phẩm / Biến thể</span>
              <div className="relative">
                <div className="flex rounded border bg-white focus-within:ring-2 focus-within:ring-neutral-900/10">
                  <input
                    className="min-w-0 flex-1 rounded-l px-3 py-2 outline-none"
                    value={variantSearch}
                    onChange={(event) => applyVariantSearch(event.target.value)}
                    onFocus={() => setIsVariantListOpen(true)}
                    placeholder="Gõ tên sản phẩm, màu, size hoặc SKU"
                    disabled={isSaving}
                  />
                  <button
                    type="button"
                    className="border-l px-3 text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                    onClick={() => setIsVariantListOpen((current) => !current)}
                    disabled={isSaving}
                    aria-label="Mở danh sách sản phẩm"
                  >
                    ▾
                  </button>
                </div>
                {isVariantListOpen && (
                  <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-white py-1 shadow-lg">
                    {filteredProducts.length > 0 ? (
                      filteredProducts.map((product) => (
                        <button
                          key={product.label}
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100"
                          onClick={() => selectProduct(product.label)}
                        >
                          <span className="block font-medium">{product.label}</span>
                          <span className="text-xs text-neutral-500">
                            {product.count} biến thể / size
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-sm text-neutral-500">Không tìm thấy sản phẩm phù hợp.</div>
                    )}
                  </div>
                )}
              </div>
              {variantSearch && !selectedProductName && (
                <span className="mt-1 block text-xs text-amber-600">
                  Hãy chọn đúng một sản phẩm trong danh sách trước khi chọn size.
                </span>
              )}
              <span className="mt-1 block text-xs text-neutral-500">
                Ví dụ: Áo thun basic
              </span>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Size</span>
              <select
                className="w-full rounded border px-3 py-2"
                value={form.size_id}
                onChange={(event) => selectSize(event.target.value)}
                disabled={isSaving || !selectedProductName}
              >
                <option value="">Chọn size</option>
                {sizeOptions.map((variant) => (
                  <option key={variant.variant_id} value={variant.variant_id}>
                    Size {variant.size || "Chưa rõ"} - {variant.color || "Màu chưa rõ"} - SKU: {variant.sku || variant.variant_id}
                  </option>
                ))}
              </select>
              {!selectedProductName && (
                <span className="mt-1 block text-xs text-neutral-500">Chọn sản phẩm trước để xem size có sẵn.</span>
              )}
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <ReadOnlyMetric label="Tồn kho hiện tại" value={selectedVariant ? currentStock : "-"} />
              <label className="block text-sm">
                <span className="mb-1 block font-medium">{action === "import" ? "Số lượng nhập thêm" : "Số lượng thay đổi"}</span>
                <input
                  className="w-full rounded border px-3 py-2"
                  type="number"
                  min={action === "import" ? 1 : undefined}
                  step={1}
                  value={form.change_quantity}
                  onChange={(event) => onChange({ ...form, change_quantity: event.target.value })}
                  placeholder={action === "import" ? "20" : "Ví dụ: -3 hoặc 5"}
                  disabled={isSaving}
                />
                {action === "adjust" && (
                  <span className="mt-1 block text-xs text-neutral-500">Nhập số âm để trừ kho hoặc số dương để cộng kho.</span>
                )}
              </label>
              <ReadOnlyMetric
                label={action === "import" ? "Tồn kho sau nhập" : "Tồn kho sau điều chỉnh"}
                value={selectedVariant && form.change_quantity ? stockAfterImport : "-"}
              />
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">{action === "import" ? "Lý do nhập kho" : "Lý do điều chỉnh kho"}</span>
              <select
                className="w-full rounded border px-3 py-2"
                value={form.reason}
                onChange={(event) => onChange({ ...form, reason: event.target.value })}
                disabled={isSaving}
              >
                {action === "import" ? (
                  <>
                    <option value="Nhập hàng mới">Nhập hàng mới</option>
                    <option value="Bổ sung tồn kho">Bổ sung tồn kho</option>
                    <option value="Điều chỉnh sau kiểm kê">Điều chỉnh sau kiểm kê</option>
                  </>
                ) : (
                  <>
                    <option value="Điều chỉnh sau kiểm kê">Điều chỉnh sau kiểm kê</option>
                    <option value="Sai lệch tồn kho">Sai lệch tồn kho</option>
                    <option value="Hàng lỗi / hư hỏng">Hàng lỗi / hư hỏng</option>
                    <option value="Bổ sung tồn kho">Bổ sung tồn kho</option>
                  </>
                )}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium">Ghi chú</span>
              <textarea
                className="min-h-24 w-full rounded border px-3 py-2"
                value={form.note}
                onChange={(event) => onChange({ ...form, note: event.target.value })}
                placeholder="..."
                disabled={isSaving}
              />
            </label>

            {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-md border px-4 py-2" onClick={onClose} disabled={isSaving}>
                Hủy
              </button>
              <button type="submit" className="rounded-md bg-neutral-950 px-4 py-2 text-white disabled:opacity-60" disabled={isSaving}>
                {isSaving ? "Đang lưu..." : action === "import" ? "Lưu nhập kho" : "Lưu điều chỉnh"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
}

function formatVariantOption(variant: StockVariantOption) {
  const productName = getVariantProductName(variant);
  const color = variant.color || "Màu chưa rõ";
  const size = variant.size || "Size chưa rõ";
  const sku = variant.sku || `#${variant.variant_id}`;
  return `${productName} - ${color} - Size ${size} - SKU: ${sku}`;
}

function ShipmentModal({
  order,
  form,
  error,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: {
  order: StaffOrder;
  form: ShipmentForm;
  error: string;
  isSaving: boolean;
  onChange: (form: ShipmentForm) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const carriers = ["Giao hàng nhanh", "Giao hàng tiết kiệm", "Viettel Post", "VNPost", "J&T Express"];
  const isOtherCarrier = form.carrier_name === "__other__" || (Boolean(form.carrier_name) && !carriers.includes(form.carrier_name));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Thông tin giao hàng</h2>
            <p className="text-sm text-neutral-500">Đơn hàng #{order.order_id}</p>
          </div>
          <button className="rounded border px-3 py-1 text-sm" onClick={onClose} disabled={isSaving}>
            Đóng
          </button>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Đơn vị vận chuyển</span>
            <select
              className="w-full rounded border px-3 py-2"
              value={isOtherCarrier ? "__other__" : form.carrier_name}
              onChange={(event) => onChange({ ...form, carrier_name: event.target.value })}
              disabled={isSaving}
            >
              {carriers.map((carrier) => (
                <option key={carrier} value={carrier}>{carrier}</option>
              ))}
              <option value="__other__">Khác</option>
            </select>
            {!form.carrier_name && (
              <span className="mt-1 block text-xs text-neutral-500">Chọn đơn vị vận chuyển</span>
            )}
          </label>

          {isOtherCarrier && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Nhập đơn vị vận chuyển khác</span>
              <input
                className="w-full rounded border px-3 py-2"
                value={form.carrier_name === "__other__" ? "" : form.carrier_name}
                onChange={(event) => onChange({ ...form, carrier_name: event.target.value || "__other__" })}
                placeholder="Nhập tên đơn vị vận chuyển"
                disabled={isSaving}
              />
            </label>
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Mã vận đơn</span>
            <input
              className="w-full rounded border bg-neutral-50 px-3 py-2"
              value={form.tracking_code}
              readOnly
            />
            <span className="mt-1 block text-xs text-neutral-500">Mã vận đơn được hệ thống tự sinh khi mở box giao hàng.</span>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Ghi chú giao hàng</span>
            <textarea
              className="min-h-24 w-full rounded border px-3 py-2"
              value={form.note}
              onChange={(event) => onChange({ ...form, note: event.target.value })}
              placeholder="Ghi chú cho đơn vị vận chuyển hoặc nhân viên xử lý"
              disabled={isSaving}
            />
          </label>

          {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-md border px-4 py-2" onClick={onClose} disabled={isSaving}>
              Hủy
            </button>
            <button type="submit" className="rounded-md bg-neutral-950 px-4 py-2 text-white disabled:opacity-60" disabled={isSaving}>
              {isSaving ? "Đang lưu..." : "Xác nhận giao hàng"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getVariantProductName(variant: StockVariantOption) {
  return variant.product_name || variant.product?.name || "Sản phẩm";
}

function getUniqueProductOptions(variants: StockVariantOption[]) {
  const map = new Map<string, number>();
  variants.forEach((variant) => {
    const productName = getVariantProductName(variant);
    map.set(productName, (map.get(productName) ?? 0) + 1);
  });
  return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
}

function ReadOnlyMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border bg-neutral-50 px-3 py-2 text-sm">
      <div className="mb-1 font-medium text-neutral-600">{label}</div>
      <div className="text-lg font-semibold text-neutral-950">{value}</div>
    </div>
  );
}

function OrderDetailPanel({ order, onClose }: { order: StaffOrder; onClose: () => void }) {
  const customer = order.customer ?? {};
  const address = order.shipping_address ?? {};

  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-semibold">Chi tiết đơn #{order.order_id}</h2>
        <button className="rounded border px-3 py-1 text-sm" onClick={onClose}>Đóng</button>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <div className="rounded border p-3 text-sm">
          <div className="font-medium">Khách hàng mua</div>
          <div className="mt-2">Tên: {customer.full_name || address.receiver_name || "Chưa có"}</div>
          <div>Email: {customer.email || "Chưa có"}</div>
          <div>Số điện thoại: {customer.phone || address.receiver_phone || "Chưa có"}</div>
          <div>Mã khách: {customer.customer_code || "Chưa có"}</div>
        </div>
        <div className="rounded border p-3 text-sm">
          <div className="font-medium">Thông tin giao hàng</div>
          <div className="mt-2">Người nhận: {address.receiver_name || "Chưa có"}</div>
          <div>Số điện thoại nhận: {address.receiver_phone || "Chưa có"}</div>
          <div>
            Địa chỉ: {[address.address_line, address.ward, address.district, address.province].filter(Boolean).join(", ") || "Chưa có"}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {(order.items ?? []).map((item) => {
          const productName = item.product_name_snapshot || item.product?.name || "Sản phẩm";
          const subtotal = Number(item.subtotal ?? Number(item.price) * item.quantity);
          return (
            <div key={item.order_item_id} className="flex gap-3 rounded border p-3 text-sm">
              {item.product?.image && <img src={item.product.image} alt={productName} className="h-20 w-16 rounded object-cover" />}
              <div className="min-w-0 flex-1">
                <div className="font-medium">{productName}</div>
                <div className="mt-1 text-neutral-600">Brand: {item.brand_name_snapshot || "Chưa có"} · Loại: {item.category_name_snapshot || "Chưa có"}</div>
                <div className="text-neutral-600">SKU: {item.sku_snapshot || "Chưa có"} · Size: {item.size_snapshot || "Chưa có"} · Màu: {item.color_snapshot || "Chưa có"}</div>
                <div className="text-neutral-600">Số lượng: {item.quantity} · Đơn giá: {Number(item.price).toLocaleString("vi-VN")}đ</div>
              </div>
              <div className="whitespace-nowrap font-medium">{subtotal.toLocaleString("vi-VN")}đ</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-2 rounded-lg border bg-white p-4"><h2 className="mb-3 font-semibold">{title}</h2>{children}</section>;
}
