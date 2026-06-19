import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  Package,
  ReceiptText,
  Sparkles,
  Users,
} from "lucide-react";
import {
  fetchAdminDashboard,
  fetchAdminRevenueReport,
  type AdminDashboardSummary,
  type RevenueGroupBy,
} from "../../lib/api";

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function AdminDashboard() {
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [revenueRows, setRevenueRows] = useState<Array<Record<string, unknown>>>(
    [],
  );
  const [fromDate, setFromDate] = useState(() => getDefaultFromDate());
  const [toDate, setToDate] = useState(() => getTodayDate());
  const [groupBy, setGroupBy] = useState<RevenueGroupBy>("month");
  const [error, setError] = useState("");
  const [revenueError, setRevenueError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRevenueLoading, setIsRevenueLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    fetchAdminDashboard()
      .then((data) => {
        if (isMounted) {
          setSummary(data);
          setRevenueRows(data.revenue);
          setError("");
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Không tải được dashboard");
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setIsRevenueLoading(true);

    fetchAdminRevenueReport({ fromDate, toDate, groupBy })
      .then((data) => {
        if (isMounted) {
          setRevenueRows(data.revenue);
          setRevenueError("");
        }
      })
      .catch((err) => {
        if (isMounted) {
          setRevenueError(
            err instanceof Error ? err.message : "Không tải được biểu đồ doanh thu",
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsRevenueLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [fromDate, groupBy, toDate]);

  const ctrLabel = useMemo(() => {
    const ctr = summary?.recommendationCtr ?? 0;
    const percent = ctr > 1 ? ctr : ctr * 100;
    return `${Math.round(percent)}%`;
  }, [summary]);

  const filteredRevenueTotal = useMemo(
    () =>
      revenueRows.reduce(
        (sum, row) =>
          sum +
          Number(row.revenue ?? row.total_revenue ?? row.total_amount ?? 0),
        0,
      ),
    [revenueRows],
  );

  const handleQuarterChange = (value: string) => {
    if (!value) return;
    const [year, quarter] = value.split("-Q");
    const quarterNumber = Number(quarter);
    if (!year || !Number.isFinite(quarterNumber)) return;

    const startMonth = (quarterNumber - 1) * 3;
    const start = new Date(Number(year), startMonth, 1);
    const end = new Date(Number(year), startMonth + 3, 0);
    setFromDate(formatDateInput(start));
    setToDate(formatDateInput(end));
    setGroupBy("quarter");
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-neutral-50 px-6 py-8">
        <div className="mx-auto max-w-7xl text-neutral-500">
          Đang tải dashboard...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header>
          <p className="text-sm uppercase tracking-wide text-neutral-500">
            Tổng quan cửa hàng
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-neutral-950">
            Dashboard
          </h1>
        </header>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Metric
            icon={<Package className="h-5 w-5" />}
            label="Sản phẩm"
            value={summary?.totalProducts ?? 0}
          />
          <Metric
            icon={<Users className="h-5 w-5" />}
            label="Tài khoản"
            value={summary?.totalUsers ?? 0}
          />
          <Metric
            icon={<ReceiptText className="h-5 w-5" />}
            label="Đơn hàng"
            value={summary?.totalOrders ?? 0}
            hint={`${summary?.pendingOrders ?? 0} đơn đang chờ xử lý`}
          />
          <Metric
            icon={<BarChart3 className="h-5 w-5" />}
            label="Doanh thu"
            value={currency.format(summary?.revenueTotal ?? 0)}
          />
          <Metric
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Tồn kho thấp"
            value={summary?.lowStockCount ?? 0}
          />
          <Metric
            icon={<ReceiptText className="h-5 w-5" />}
            label="Đã thanh toán"
            value={summary?.paidOrders ?? 0}
          />
          <Metric
            icon={<Sparkles className="h-5 w-5" />}
            label="CTR gợi ý AI"
            value={ctrLabel}
          />
        </section>

        <Panel
          title="Biểu đồ doanh thu"
          action={
            <div className="flex flex-wrap items-end gap-2">
              <label className="space-y-1 text-xs text-neutral-500">
                <span>Từ ngày</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="block rounded-md border px-3 py-2 text-sm text-neutral-900"
                />
              </label>
              <label className="space-y-1 text-xs text-neutral-500">
                <span>Đến ngày</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="block rounded-md border px-3 py-2 text-sm text-neutral-900"
                />
              </label>
              <label className="space-y-1 text-xs text-neutral-500">
                <span>Hiển thị</span>
                <select
                  value={groupBy}
                  onChange={(event) =>
                    setGroupBy(event.target.value as RevenueGroupBy)
                  }
                  className="block rounded-md border px-3 py-2 text-sm text-neutral-900"
                >
                  <option value="day">Theo ngày</option>
                  <option value="month">Theo tháng</option>
                  <option value="quarter">Theo quý</option>
                </select>
              </label>
              <label className="space-y-1 text-xs text-neutral-500">
                <span>Chọn nhanh quý</span>
                <select
                  defaultValue=""
                  onChange={(event) => handleQuarterChange(event.target.value)}
                  className="block rounded-md border px-3 py-2 text-sm text-neutral-900"
                >
                  <option value="" disabled>
                    Chọn quý
                  </option>
                  {buildQuarterOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          }
        >
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium text-neutral-950">
              Tổng doanh thu theo bộ lọc: {currency.format(filteredRevenueTotal)}
            </span>
            {isRevenueLoading && (
              <span className="text-neutral-500">Đang cập nhật...</span>
            )}
            {revenueError && <span className="text-red-600">{revenueError}</span>}
          </div>
          <RevenueChart rows={revenueRows} />
        </Panel>

        <section className="grid gap-4 lg:grid-cols-2">
          <Panel title="Sản phẩm bán chạy">
            <MiniTable rows={summary?.bestProducts ?? []} />
          </Panel>
          <Panel title="Doanh thu theo bộ lọc">
            <MiniTable rows={revenueRows} />
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-5">
      <div className="flex items-center justify-between text-neutral-500">
        <span className="text-sm">{label}</span>
        {icon}
      </div>
      <div className="mt-3 text-2xl font-semibold text-neutral-950">
        {value}
      </div>
      {hint && <div className="mt-1 text-sm text-neutral-500">{hint}</div>}
    </div>
  );
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-white p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-semibold text-neutral-950">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function RevenueChart({ rows }: { rows: Array<Record<string, unknown>> }) {
  const points = rows.map((row) => ({
    period: String(row.period ?? row.date ?? row.month ?? ""),
    revenue: Number(row.revenue ?? row.total_revenue ?? row.total_amount ?? 0),
    orders: Number(row.total_orders ?? row.order_count ?? row.orders ?? 0),
  }));

  if (!points.length) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed text-sm text-neutral-500">
        Chưa có dữ liệu doanh thu trong khoảng thời gian này
      </div>
    );
  }

  const maxRevenue = Math.max(...points.map((point) => point.revenue), 1);
  const chartHeight = 260;
  const chartWidth = Math.max(680, points.length * 72);
  const padding = { top: 18, right: 18, bottom: 54, left: 72 };
  const innerHeight = chartHeight - padding.top - padding.bottom;
  const innerWidth = chartWidth - padding.left - padding.right;
  const barWidth = Math.max(
    18,
    Math.min(44, innerWidth / Math.max(points.length, 1) - 18),
  );

  return (
    <div className="overflow-x-auto">
      <svg
        width={chartWidth}
        height={chartHeight}
        role="img"
        aria-label="Biểu đồ doanh thu"
        className="min-w-full"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + innerHeight * (1 - ratio);
          const value = maxRevenue * ratio;
          return (
            <g key={ratio}>
              <line
                x1={padding.left}
                x2={chartWidth - padding.right}
                y1={y}
                y2={y}
                stroke="#e5e5e5"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="fill-neutral-500 text-[11px]"
              >
                {compactCurrency(value)}
              </text>
            </g>
          );
        })}

        {points.map((point, index) => {
          const slotWidth = innerWidth / Math.max(points.length, 1);
          const x = padding.left + index * slotWidth + (slotWidth - barWidth) / 2;
          const barHeight = (point.revenue / maxRevenue) * innerHeight;
          const y = padding.top + innerHeight - barHeight;
          return (
            <g key={`${point.period}-${index}`}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={5}
                className="fill-neutral-900"
              />
              <title>
                {point.period}: {currency.format(point.revenue)} ({point.orders} đơn)
              </title>
              <text
                x={x + barWidth / 2}
                y={chartHeight - 28}
                textAnchor="middle"
                className="fill-neutral-600 text-[11px]"
              >
                {point.period}
              </text>
              <text
                x={x + barWidth / 2}
                y={Math.max(12, y - 6)}
                textAnchor="middle"
                className="fill-neutral-700 text-[11px]"
              >
                {compactCurrency(point.revenue)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MiniTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  if (!rows.length) {
    return <div className="text-sm text-neutral-500">Chưa có dữ liệu</div>;
  }

  const columns = Object.keys(rows[0]).slice(0, 4);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-2 py-2 font-medium text-neutral-500">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 6).map((row, index) => (
            <tr key={index} className="border-t">
              {columns.map((column) => (
                <td key={column} className="max-w-[180px] truncate px-2 py-2">
                  {formatValue(row[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatValue(value: unknown) {
  if (value == null) return "";
  if (typeof value === "number") return value.toLocaleString("vi-VN");
  if (typeof value === "boolean") return value ? "Bật" : "Tắt";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getTodayDate() {
  return formatDateInput(new Date());
}

function getDefaultFromDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 5);
  date.setDate(1);
  return formatDateInput(date);
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildQuarterOptions() {
  const currentYear = new Date().getFullYear();
  return [currentYear, currentYear - 1].flatMap((year) =>
    [1, 2, 3, 4].map((quarter) => ({
      value: `${year}-Q${quarter}`,
      label: `Quý ${quarter}/${year}`,
    })),
  );
}

function compactCurrency(value: number) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString("vi-VN", {
      maximumFractionDigits: 1,
    })} tỷ`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("vi-VN", {
      maximumFractionDigits: 1,
    })} tr`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000).toLocaleString("vi-VN")}k`;
  }
  return value.toLocaleString("vi-VN");
}
