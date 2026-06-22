import { useEffect, useState, type ReactNode } from "react";
import { History } from "lucide-react";

import { AdminAuditHistoryModal } from "../../components/admin/AdminAuditHistoryModal";
import {
  completeAdminOrderRefund,
  fetchAdminAuditLogs,
  fetchAdminOrders,
  type AdminProductHistoryItem,
  type ApiOrder,
} from "../../lib/api";

type OrderFilters = {
  status: string;
  payment_method: string;
  from_date: string;
  to_date: string;
};

type AdminOrder = ApiOrder & {
  customer?: {
    customer_id?: number | null;
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
  updated_at?: string;
  shipment?: {
    carrier_name?: string;
    tracking_code?: string;
    shipment_status?: string;
    shipped_at?: string | null;
    delivered_at?: string | null;
  } | null;
  status_histories?: Array<{
    history_id: number;
    from_status?: string;
    to_status?: string;
    note?: string;
    created_at?: string;
  }>;
};

type AdminOrderItem = AdminOrder["items"][number] & {
  subtotal?: number;
  product_name_snapshot?: string;
  brand_name_snapshot?: string;
  category_name_snapshot?: string;
  sku_snapshot?: string;
  color_snapshot?: string;
  size_snapshot?: string;
};

const statusLabels: Record<string, string> = {
  pending: "Chờ xử lý",
  confirmed: "Xác nhận",
  processing: "Đang xử lý",
  waiting_pickup: "Chờ lấy hàng",
  shipped: "Đang giao",
  delivered: "Đã giao hàng",
  completed: "Hoàn thành",
  cancelled: "Hủy đơn",
};

const paymentStatusLabels: Record<string, string> = {
  unpaid: "Chưa thanh toán",
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  failed: "Thanh toán thất bại",
  expired: "Hết hạn thanh toán",
  refund_pending: "Chờ hoàn tiền",
  refunded: "Đã hoàn tiền",
};

const paymentMethodLabels: Record<string, string> = {
  cod: "COD",
  vnpay: "VNPay",
  momo: "MoMo",
  bank_transfer: "Chuyển khoản",
};

const shipmentStatusLabels: Record<string, string> = {
  pending: "Chờ giao",
  shipped: "Đang giao",
  delivered: "Đã giao",
  cancelled: "Đã hủy",
};

const columnLabels: Record<string, string> = {
  order_id: "Mã đơn hàng",
  status: "Trạng thái đơn hàng",
  payment_status: "Trạng thái thanh toán",
  payment_method: "Phương thức thanh toán",
  final_amount: "Tổng tiền",
  created_at: "Ngày tạo",
};

export function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [filters, setFilters] = useState<OrderFilters>({ status: "", payment_method: "", from_date: "", to_date: "" });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [historyItems, setHistoryItems] = useState<AdminProductHistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [refundOrder, setRefundOrder] = useState<AdminOrder | null>(null);
  const [refundReference, setRefundReference] = useState("");
  const [isSavingRefund, setIsSavingRefund] = useState(false);
  const [refundError, setRefundError] = useState("");

  async function loadOrders() {
    setIsLoading(true);
    try {
      setOrders((await fetchAdminOrders(filters)) as AdminOrder[]);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được đơn hàng");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadOrders();
  }, [filters.status, filters.payment_method, filters.from_date, filters.to_date]);

  async function openHistory() {
    setIsHistoryOpen(true);
    setHistoryItems([]);
    setIsHistoryLoading(true);
    try {
      setHistoryItems(await fetchAdminAuditLogs({ entity_type: "order" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được lịch sử chỉnh sửa");
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function submitRefund(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!refundOrder) return;
    const reference = refundReference.trim();
    if (!reference) {
      setRefundError("Vui lòng nhập mã tham chiếu hoàn tiền.");
      return;
    }
    setIsSavingRefund(true);
    setRefundError("");
    try {
      await completeAdminOrderRefund(refundOrder.order_id, reference);
      setRefundOrder(null);
      setSelectedOrder(null);
      setRefundReference("");
      await loadOrders();
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : "Không thể xác nhận hoàn tiền.");
    } finally {
      setIsSavingRefund(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
          <h1 className="text-2xl font-semibold text-neutral-950">Đơn hàng</h1>
          <p className="text-sm text-neutral-500">
            Admin xem trạng thái và chi tiết đơn hàng toàn hệ thống. Thao tác xử lý đơn nằm ở Staff Portal.
          </p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md border bg-white px-4 py-2 text-sm" onClick={openHistory}>
            <History className="h-4 w-4" />
            Xem lịch sử chỉnh sửa
          </button>
        </header>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Panel title="Bộ lọc đơn hàng">
          <div className="grid gap-3 md:grid-cols-4">
            <select className="rounded border px-3 py-2" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">Mọi trạng thái</option>
              <option value="pending">Chờ xử lý</option>
              <option value="confirmed">Xác nhận</option>
              <option value="processing">Đang xử lý</option>
              <option value="waiting_pickup">Chờ lấy hàng</option>
              <option value="shipped">Đang giao</option>
              <option value="delivered">Đã giao hàng</option>
              <option value="completed">Hoàn thành</option>
              <option value="cancelled">Hủy đơn</option>
            </select>
            <select className="rounded border px-3 py-2" value={filters.payment_method} onChange={(event) => setFilters({ ...filters, payment_method: event.target.value })}>
              <option value="">Mọi thanh toán</option>
              <option value="cod">COD</option>
              <option value="vnpay">VNPay</option>
              <option value="momo">MoMo</option>
              <option value="bank_transfer">Chuyển khoản</option>
            </select>
            <input className="rounded border px-3 py-2" type="date" value={filters.from_date} onChange={(event) => setFilters({ ...filters, from_date: event.target.value })} />
            <input className="rounded border px-3 py-2" type="date" value={filters.to_date} onChange={(event) => setFilters({ ...filters, to_date: event.target.value })} />
          </div>
        </Panel>

        <Panel title="Danh sách đơn hàng toàn hệ thống">
          {isLoading ? (
            <div className="py-8 text-sm text-neutral-500">Đang tải đơn hàng...</div>
          ) : (
            <DataTable
              rows={orders}
              columns={[
                "order_id",
                "status",
                "payment_status",
                "payment_method",
                "final_amount",
                "created_at",
              ]}
              onSelect={setSelectedOrder}
            />
          )}
        </Panel>
      </div>

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onRefund={() => {
            setRefundOrder(selectedOrder);
            setRefundReference("");
            setRefundError("");
          }}
        />
      )}
      {refundOrder && (
        <RefundModal
          order={refundOrder}
          reference={refundReference}
          error={refundError}
          isSaving={isSavingRefund}
          onChange={setRefundReference}
          onClose={() => {
            if (!isSavingRefund) setRefundOrder(null);
          }}
          onSubmit={submitRefund}
        />
      )}
      {isHistoryOpen && (
        <AdminAuditHistoryModal
          title="Lịch sử chỉnh sửa đơn hàng"
          items={historyItems}
          isLoading={isHistoryLoading}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </main>
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

function DataTable<T extends object>({
  rows,
  columns,
  onSelect,
}: {
  rows: T[];
  columns: Array<Extract<keyof T, string>>;
  onSelect?: (row: T) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-2 py-2 text-neutral-500">
                {columnLabels[column] ?? column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="cursor-pointer border-t hover:bg-neutral-50"
              onClick={() => onSelect?.(row)}
            >
              {columns.map((column) => (
                <td key={column} className="max-w-[220px] truncate px-2 py-2">
                  {formatCell(column, row[column as keyof T])}
                </td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td className="px-2 py-4 text-neutral-500" colSpan={columns.length}>
                Chưa có đơn hàng trong hệ thống
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function OrderDetailModal({
  order,
  onClose,
  onRefund,
}: {
  order: AdminOrder;
  onClose: () => void;
  onRefund: () => void;
}) {
  const address = order.shipping_address;
  const customer = order.customer;
  const shipment = order.shipment;
  const items = (order.items ?? []) as AdminOrderItem[];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6" onClick={onClose}>
      <section
        className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-neutral-950">Chi tiết đơn hàng #{order.order_id}</h2>
            <p className="text-sm text-neutral-500">Ngày tạo: {formatDate(order.created_at)}</p>
          </div>
          <button className="rounded border px-3 py-1.5 text-sm hover:bg-neutral-50" type="button" onClick={onClose}>
            Đóng
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <InfoCard title="Thông tin đơn hàng">
              <DetailLine label="Trạng thái đơn" value={statusLabels[order.status] ?? order.status} />
              <DetailLine label="Thanh toán" value={paymentStatusLabels[order.payment_status] ?? order.payment_status} />
              <DetailLine label="Phương thức" value={paymentMethodLabels[order.payment_method] ?? order.payment_method} />
              <DetailLine label="Cập nhật lần cuối" value={formatDate(order.updated_at)} />
            </InfoCard>

            <InfoCard title="Khách hàng">
              <DetailLine label="Họ tên" value={customer?.full_name} />
              <DetailLine label="Email" value={customer?.email} />
              <DetailLine label="Số điện thoại" value={customer?.phone} />
              <DetailLine label="Mã khách hàng" value={customer?.customer_code} />
            </InfoCard>

            <InfoCard title="Giao hàng">
              <DetailLine label="Người nhận" value={address?.receiver_name} />
              <DetailLine label="Số điện thoại" value={address?.receiver_phone} />
              <DetailLine label="Địa chỉ" value={formatAddress(address)} />
              <DetailLine label="Đơn vị vận chuyển" value={shipment?.carrier_name} />
              <DetailLine label="Mã vận đơn" value={shipment?.tracking_code} />
              <DetailLine label="Trạng thái giao" value={shipment?.shipment_status ? shipmentStatusLabels[shipment.shipment_status] ?? shipment.shipment_status : ""} />
            </InfoCard>
          </div>

          <InfoCard title="Sản phẩm trong đơn">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-neutral-500">
                    <th className="py-2 pr-3">Sản phẩm</th>
                    <th className="py-2 pr-3">SKU</th>
                    <th className="py-2 pr-3">Màu</th>
                    <th className="py-2 pr-3">Size</th>
                    <th className="py-2 pr-3 text-right">Số lượng</th>
                    <th className="py-2 pr-3 text-right">Đơn giá</th>
                    <th className="py-2 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.order_item_id} className="border-b last:border-b-0">
                      <td className="py-2 pr-3">
                        <div className="font-medium text-neutral-900">
                          {item.product_name_snapshot || item.product?.name || "Sản phẩm"}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {[item.brand_name_snapshot, item.category_name_snapshot].filter(Boolean).join(" - ")}
                        </div>
                      </td>
                      <td className="py-2 pr-3">{item.sku_snapshot || "-"}</td>
                      <td className="py-2 pr-3">{item.color_snapshot || "-"}</td>
                      <td className="py-2 pr-3">{item.size_snapshot || "-"}</td>
                      <td className="py-2 pr-3 text-right">{item.quantity}</td>
                      <td className="py-2 pr-3 text-right">{formatMoney(item.price)}</td>
                      <td className="py-2 text-right">{formatMoney(item.subtotal ?? item.price * item.quantity)}</td>
                    </tr>
                  ))}
                  {!items.length && (
                    <tr>
                      <td className="py-4 text-neutral-500" colSpan={7}>Chưa có sản phẩm trong đơn</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </InfoCard>

          <div className="grid gap-4 md:grid-cols-[1fr_360px]">
            <InfoCard title="Lịch sử trạng thái">
              <div className="space-y-3">
                {(order.status_histories ?? []).map((history) => (
                  <div key={history.history_id} className="rounded border px-3 py-2 text-sm">
                    <div className="font-medium">
                      {statusLabels[history.from_status || ""] ?? history.from_status ?? "-"} → {statusLabels[history.to_status || ""] ?? history.to_status ?? "-"}
                    </div>
                    <div className="text-neutral-500">{formatDate(history.created_at)}</div>
                    {history.note && <div className="mt-1 text-neutral-700">{history.note}</div>}
                  </div>
                ))}
                {!order.status_histories?.length && (
                  <div className="text-sm text-neutral-500">Chưa có lịch sử trạng thái</div>
                )}
              </div>
            </InfoCard>

            <InfoCard title="Tổng kết thanh toán">
              <DetailLine label="Tạm tính" value={formatMoney(order.total_amount)} />
              <DetailLine label="Phí vận chuyển" value={formatMoney(order.shipping_fee)} />
              <DetailLine label="Giảm giá" value={formatMoney(order.discount_amount)} />
              <div className="mt-3 flex items-center justify-between border-t pt-3 font-semibold">
                <span>Tổng tiền</span>
                <span>{formatMoney(order.final_amount)}</span>
              </div>
              {order.payment_status === "refund_pending" && (
                <button
                  type="button"
                  onClick={onRefund}
                  className="mt-4 w-full rounded bg-neutral-950 px-4 py-2 text-sm font-medium text-white"
                >
                  Xác nhận đã hoàn tiền
                </button>
              )}
            </InfoCard>
          </div>
        </div>
      </section>
    </div>
  );
}

function RefundModal({
  order,
  reference,
  error,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: {
  order: AdminOrder;
  reference: string;
  error: string;
  isSaving: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">Xác nhận hoàn tiền đơn #{order.order_id}</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Chỉ xác nhận sau khi đã hoàn tiền bên ngoài hệ thống. Mã tham chiếu sẽ được lưu để đối soát.
        </p>
        <label className="mt-4 block text-sm font-medium">
          Mã tham chiếu hoàn tiền
          <input
            autoFocus
            required
            value={reference}
            onChange={(event) => onChange(event.target.value)}
            className="mt-2 w-full rounded border px-3 py-2"
          />
        </label>
        {error && <div className="mt-3 rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded border px-4 py-2">
            Hủy
          </button>
          <button
            type="submit"
            disabled={isSaving || !reference.trim()}
            className="rounded bg-neutral-950 px-4 py-2 text-white disabled:opacity-50"
          >
            {isSaving ? "Đang lưu..." : "Xác nhận"}
          </button>
        </div>
      </form>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border p-4">
      <h3 className="mb-3 font-semibold text-neutral-950">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function DetailLine({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="min-w-28 text-neutral-500">{label}</span>
      <span className="flex-1 text-neutral-900">{value || "-"}</span>
    </div>
  );
}

function formatCell(column: string, value: unknown) {
  if (value == null) return "";
  if (column === "status") return statusLabels[String(value)] ?? String(value);
  if (column === "payment_status") return paymentStatusLabels[String(value)] ?? String(value);
  if (column === "payment_method") return paymentMethodLabels[String(value)] ?? String(value);
  if (column === "final_amount") return formatMoney(Number(value));
  if (column === "created_at") return formatDate(String(value));
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatMoney(value?: number) {
  return `${Number(value || 0).toLocaleString("vi-VN")}đ`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

function formatAddress(address?: AdminOrder["shipping_address"]) {
  if (!address) return "";
  return [address.address_line, address.ward, address.district, address.province].filter(Boolean).join(", ");
}
