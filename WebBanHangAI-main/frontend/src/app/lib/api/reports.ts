import type { ApiUser } from "./auth";
import type { ApiOrder } from "./orders";
import { fetchAdminProducts } from "./admin";
import { apiGet } from "../apiClient";

export interface AdminDashboardSummary {
  totalProducts: number;
  totalUsers: number;
  totalOrders: number;
  revenueTotal: number;
  lowStockCount: number;
  pendingOrders: number;
  paidOrders: number;
  recommendationCtr: number;
  orderStatus: Array<Record<string, unknown>>;
  bestProducts: Array<Record<string, unknown>>;
  revenue: Array<Record<string, unknown>>;
}

export type RevenueGroupBy = "day" | "month" | "quarter";

export interface AdminRevenueReport {
  revenue: Array<Record<string, unknown>>;
  payment_methods: Array<Record<string, unknown>>;
}

function asApiArray<T>(
  value: T[] | { results?: T[] } | { revenue?: T[] } | null | undefined,
): T[] {
  if (Array.isArray(value)) return value;
  if (value && "results" in value && Array.isArray(value.results)) {
    return value.results;
  }
  if (value && "revenue" in value && Array.isArray(value.revenue)) {
    return value.revenue;
  }
  return [];
}

export async function fetchAdminDashboard(): Promise<AdminDashboardSummary> {
  const [
    products,
    users,
    orders,
    lowStock,
    revenueResponse,
    orderStatus,
    bestProducts,
    recommendationMetrics,
  ] = await Promise.all([
    fetchAdminProducts(),
    apiGet<ApiUser[] | { results: ApiUser[] }>(`/admin/users/`),
    apiGet<ApiOrder[] | { results: ApiOrder[] }>(`/admin/orders`),
    apiGet<Array<Record<string, unknown>>>(`/admin/inventory/low-stock`),
    apiGet<{ revenue?: Array<Record<string, unknown>> }>(`/admin/reports/revenue`),
    apiGet<Array<Record<string, unknown>>>(`/admin/reports/order-status`),
    apiGet<Array<Record<string, unknown>>>(`/admin/reports/best-products?top=5`),
    apiGet<Record<string, unknown>>(`/admin/reports/recommendations`),
  ]);

  const revenue = asApiArray(revenueResponse);
  const normalizedOrders = asApiArray(orders);
  const revenueRows = revenue.length ? revenue : buildRevenueFromOrders(normalizedOrders);
  const revenueTotal = revenueRows.reduce(
    (sum, row) =>
      sum +
      Number(row.revenue ?? row.total_revenue ?? row.total_amount ?? 0),
    0,
  );

  return {
    totalProducts: products.length,
    totalUsers: asApiArray(users).length,
    totalOrders: normalizedOrders.length,
    revenueTotal,
    lowStockCount: lowStock.length,
    pendingOrders: normalizedOrders.filter((order) => order.status === "pending").length,
    paidOrders: normalizedOrders.filter((order) => order.payment_status === "paid").length,
    recommendationCtr: Number(
      recommendationMetrics.ctr ?? recommendationMetrics.ctr_percent ?? 0,
    ),
    orderStatus,
    bestProducts,
    revenue: revenueRows,
  };
}

export async function fetchAdminRevenueReport(params: {
  fromDate?: string;
  toDate?: string;
  groupBy?: RevenueGroupBy;
}): Promise<AdminRevenueReport> {
  const query = new URLSearchParams();
  if (params.fromDate) query.set("from_date", params.fromDate);
  if (params.toDate) query.set("to_date", params.toDate);
  if (params.groupBy) query.set("group_by", params.groupBy);

  const queryString = query.toString();
  return apiGet<AdminRevenueReport>(
    `/admin/reports/revenue${queryString ? `?${queryString}` : ""}`,
  );
}

function buildRevenueFromOrders(
  orders: ApiOrder[],
): Array<Record<string, unknown>> {
  const paidOrders = orders.filter((order) => order.payment_status === "paid");
  const byMonth = new Map<string, { revenue: number; total_orders: number }>();

  for (const order of paidOrders) {
    const date = new Date(order.created_at);
    if (Number.isNaN(date.getTime())) continue;

    const period = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const current = byMonth.get(period) ?? { revenue: 0, total_orders: 0 };
    current.revenue += Number(order.final_amount ?? 0);
    current.total_orders += 1;
    byMonth.set(period, current);
  }

  return Array.from(byMonth.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([period, value]) => ({ period, ...value }));
}
