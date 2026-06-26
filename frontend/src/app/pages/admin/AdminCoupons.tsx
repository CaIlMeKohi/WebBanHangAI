import { useEffect, useMemo, useState } from "react";
import { ChevronDown, History } from "lucide-react";
import {
  createAdminCoupon,
  deleteAdminCoupon,
  fetchAdminAuditLogs,
  fetchAdminCoupons,
  fetchAdminProducts,
  fetchCategories,
  updateAdminCoupon,
  type AdminProductHistoryItem,
  type ApiCoupon,
} from "../../lib/api";
import { AdminAuditHistoryModal } from "../../components/admin/AdminAuditHistoryModal";
import type { CategoryNode } from "../../data/products";

type CouponForm = {
  coupon_id?: number;
  name: string;
  code: string;
  discount_type: "fixed" | "percentage";
  discount_value: string;
  min_order_amount: string;
  max_discount: string;
  category: string;
  product: string;
  usage_limit_mode: "unlimited" | "limited";
  start_at: string;
  end_at: string;
  expiry_mode: "forever" | "limited";
  expiry_limit_mode: "end_date" | "duration";
  duration_days: string;
  usage_limit: string;
  per_customer_limit: string;
  is_active: boolean;
};

const emptyForm: CouponForm = {
  name: "",
  code: "",
  discount_type: "fixed",
  discount_value: "",
  min_order_amount: "0",
  max_discount: "",
  category: "",
  product: "",
  usage_limit_mode: "unlimited",
  start_at: "",
  end_at: "",
  expiry_mode: "forever",
  expiry_limit_mode: "end_date",
  duration_days: "",
  usage_limit: "",
  per_customer_limit: "1",
  is_active: true,
};

const ALL_CATEGORIES_OPTION_ID = "__all__";
const ALL_CATEGORIES_OPTION_NAME = "Tất cả danh mục, sản phẩm";

function flattenCategories(categories: CategoryNode[]): Array<{ id: number; name: string }> {
  const result: Array<{ id: number; name: string }> = [];
  function visit(items: CategoryNode[], parents: string[] = []) {
    items.forEach((category) => {
      const path = [...parents, category.name];
      if (typeof category.id === "number") result.push({ id: category.id, name: path.join(" / ") });
      if (category.children?.length) visit(category.children, path);
    });
  }
  visit(categories);
  return result;
}

function categoryIdsInScope(categories: CategoryNode[], selectedId: number): number[] {
  function collect(category: CategoryNode): number[] {
    return [
      ...(typeof category.id === "number" ? [category.id] : []),
      ...(category.children ?? []).flatMap(collect),
    ];
  }
  function find(items: CategoryNode[]): CategoryNode | null {
    for (const category of items) {
      if (category.id === selectedId) return category;
      const nested = find(category.children ?? []);
      if (nested) return nested;
    }
    return null;
  }
  const selected = find(categories);
  return selected ? collect(selected) : [selectedId];
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function minDateTimeLocal() {
  return startOfToday().toISOString().slice(0, 16);
}

function calculateEndDateFromDuration(startAt: string, durationDays: string) {
  if (!startAt || !durationDays || Number(durationDays) <= 0) return "";
  const startDate = new Date(startAt);
  if (Number.isNaN(startDate.getTime())) return "";
  const endDate = new Date(startDate.getTime() + Number(durationDays) * 24 * 60 * 60 * 1000);
  return endDate.toLocaleString("vi-VN");
}

function formatNumberInput(value: string | number | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("vi-VN");
}

function parseFormattedNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function fromCoupon(coupon: ApiCoupon): CouponForm {
  return {
    coupon_id: coupon.coupon_id,
    name: coupon.name ?? "",
    code: coupon.code,
    discount_type: coupon.discount_type,
    discount_value: formatNumberInput(coupon.discount_value),
    min_order_amount: formatNumberInput(coupon.min_order_amount ?? 0),
    max_discount: coupon.max_discount == null ? "" : formatNumberInput(coupon.max_discount),
    category: coupon.category == null ? "" : String(coupon.category),
    product: coupon.product == null ? "" : String(coupon.product),
    usage_limit_mode: coupon.usage_limit == null ? "unlimited" : "limited",
    start_at: toDateTimeLocal(coupon.start_at),
    end_at: toDateTimeLocal(coupon.end_at),
    expiry_mode: coupon.end_at == null ? "forever" : "limited",
    expiry_limit_mode: "end_date",
    duration_days: "",
    usage_limit: coupon.usage_limit == null ? "" : String(coupon.usage_limit),
    per_customer_limit: String(coupon.per_customer_limit ?? 1),
    is_active: coupon.is_active,
  };
}

function toPayload(form: CouponForm) {
  const startAt = form.expiry_mode === "limited" && form.start_at ? new Date(form.start_at) : null;
  const endAt =
    form.expiry_mode !== "limited"
      ? null
      : form.expiry_limit_mode === "duration" && startAt && form.duration_days
        ? new Date(startAt.getTime() + Number(form.duration_days) * 24 * 60 * 60 * 1000)
        : form.end_at
          ? new Date(form.end_at)
          : null;
  return {
    code: form.coupon_id ? form.code.trim().toUpperCase() : undefined,
    name: form.name.trim(),
    discount_type: form.discount_type,
    discount_value: parseFormattedNumber(form.discount_value),
    min_order_amount: parseFormattedNumber(form.min_order_amount),
    max_discount: form.max_discount ? parseFormattedNumber(form.max_discount) : null,
    category: form.category ? Number(form.category) : null,
    product: form.product ? Number(form.product) : null,
    start_at: startAt ? startAt.toISOString() : null,
    end_at: endAt ? endAt.toISOString() : null,
    usage_limit: form.usage_limit_mode === "limited" && form.usage_limit ? Number(form.usage_limit) : null,
    per_customer_limit: Number(form.per_customer_limit || 1),
    is_active: form.is_active,
  };
}

export function AdminCoupons() {
  const [coupons, setCoupons] = useState<ApiCoupon[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string; categoryId: number | null }>>([]);
  const [form, setForm] = useState<CouponForm>(emptyForm);
  const [categorySearch, setCategorySearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [historyItems, setHistoryItems] = useState<AdminProductHistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const flatCategories = useMemo(() => flattenCategories(categories), [categories]);
  const selectedCategoryIds = useMemo(
    () => form.category ? categoryIdsInScope(categories, Number(form.category)) : [],
    [categories, form.category],
  );
  const filteredProducts = useMemo(
    () => products.filter((product) => product.categoryId !== null && selectedCategoryIds.includes(product.categoryId)),
    [products, selectedCategoryIds],
  );

  async function load() {
    setIsLoading(true);
    try {
      const [nextCoupons, nextCategories, nextProducts] = await Promise.all([
        fetchAdminCoupons(),
        fetchCategories(),
        fetchAdminProducts(),
      ]);
      setCoupons(nextCoupons);
      setCategories(nextCategories);
      setProducts(nextProducts.map((product) => ({
        id: String(product.id),
        name: product.name,
        categoryId: product.category_id ?? null,
      })));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : "Không tải được coupon"));
  }, []);

  async function saveCoupon(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!form.discount_value || (form.usage_limit_mode === "limited" && !form.usage_limit)) {
      setMessage("Nhập giá trị giảm, số lượng/giới hạn nếu đã chọn có giới hạn.");
      return;
    }
    if (categorySearch.trim() && categorySearch !== ALL_CATEGORIES_OPTION_NAME && !form.category) {
      setMessage("Vui lòng chọn một danh mục có trong danh sách gợi ý.");
      return;
    }
    if (form.category && productSearch.trim() && productSearch !== "Tất cả sản phẩm trong danh mục" && !form.product) {
      setMessage("Vui lòng chọn một sản phẩm có trong danh mục hoặc chọn tất cả sản phẩm.");
      return;
    }
    if (form.expiry_mode === "limited") {
      if (!form.start_at) {
        setMessage("Vui lòng chọn ngày bắt đầu từ hôm nay trở đi.");
        return;
      }
      if (new Date(form.start_at) < startOfToday()) {
        setMessage("Ngày bắt đầu phải từ ngày hiện tại trở đi.");
        return;
      }
      if (form.expiry_limit_mode === "end_date" && !form.end_at) {
        setMessage("Vui lòng chọn ngày kết thúc.");
        return;
      }
      if (form.expiry_limit_mode === "end_date" && form.end_at && new Date(form.end_at) < new Date(form.start_at)) {
        setMessage("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.");
        return;
      }
      if (form.expiry_limit_mode === "duration" && (!form.duration_days || Number(form.duration_days) <= 0)) {
        setMessage("Vui lòng nhập thời hạn hiệu lực lớn hơn 0 ngày.");
        return;
      }
    }
    setIsSaving(true);
    try {
      if (form.coupon_id) {
        await updateAdminCoupon(form.coupon_id, toPayload(form));
        setMessage("Đã cập nhật coupon.");
      } else {
        await createAdminCoupon(toPayload(form));
        setMessage("Đã tạo coupon.");
      }
      setForm(emptyForm);
      setCategorySearch("");
      setProductSearch("");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không lưu được coupon.");
    } finally {
      setIsSaving(false);
    }
  }

  async function removeCoupon(coupon: ApiCoupon) {
    if (!confirm(`Xóa coupon ${coupon.code}?`)) return;
    try {
      await deleteAdminCoupon(coupon.coupon_id);
      setMessage("Đã xóa coupon.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không xóa được coupon.");
    }
  }

  async function openHistory() {
    setIsHistoryOpen(true);
    setHistoryItems([]);
    setIsHistoryLoading(true);
    try {
      setHistoryItems(await fetchAdminAuditLogs({ entity_type: "coupon" }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không tải được lịch sử chỉnh sửa");
    } finally {
      setIsHistoryLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
          <h1 className="text-2xl font-semibold text-neutral-950">Coupon giam gia</h1>
          <p className="text-sm text-neutral-500">Quản lý mã giảm giá theo toàn đơn, loại sản phẩm hoặc sản phẩm cụ thể.</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-md border bg-white px-4 py-2 text-sm" onClick={openHistory}>
            <History className="h-4 w-4" />
            Xem lịch sử chỉnh sửa
          </button>
        </header>

        {isLoading && <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">Đang lấy dữ liệu...</div>}
        {message && <div className="rounded-md border bg-white p-3 text-sm text-neutral-700">{message}</div>}

        <section className="grid gap-6 lg:grid-cols-[420px_1fr]">
          <form onSubmit={saveCoupon} className="space-y-4 rounded-lg border bg-white p-4">
            <h2 className="font-semibold">{form.coupon_id ? "Sửa coupon" : "Thêm coupon"}</h2>
            <label className="block text-sm">
              <span className="mb-1 block text-neutral-600">Tên coupon</span>
              <input
                className="w-full rounded border px-3 py-2"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="VD: Mã freeship cho đơn từ 0đ"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-neutral-600">Mã coupon</span>
              <input
                className="w-full rounded border bg-neutral-50 px-3 py-2"
                value={form.coupon_id ? form.code : "Tự động sinh sau khi lưu"}
                readOnly
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-neutral-600">Loại giảm</span>
                <select className="w-full rounded border px-3 py-2" value={form.discount_type} onChange={(event) => setForm({ ...form, discount_type: event.target.value as CouponForm["discount_type"] })}>
                  <option value="fixed">Số tiền</option>
                  <option value="percentage">Phần trăm</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-neutral-600">Giá trị</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded border px-3 py-2"
                  value={form.discount_value}
                  onChange={(event) => setForm({ ...form, discount_value: formatNumberInput(event.target.value) })}
                  placeholder={form.discount_type === "percentage" ? "VD: 10" : "VD: 100.000"}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-neutral-600">Đơn tối thiểu</span>
                <input type="text" inputMode="numeric" className="w-full rounded border px-3 py-2" value={form.min_order_amount} onChange={(event) => setForm({ ...form, min_order_amount: formatNumberInput(event.target.value) })} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-neutral-600">Giảm tối đa</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="w-full rounded border px-3 py-2"
                  value={form.max_discount}
                  onChange={(event) => setForm({ ...form, max_discount: formatNumberInput(event.target.value) })}
                  placeholder="VD: 50.000"
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-neutral-600">Loại sản phẩm áp dụng</span>
              <CouponCombobox
                value={categorySearch}
                placeholder="Nhập hoặc chọn danh mục..."
                label="danh mục"
                options={[
                  { id: ALL_CATEGORIES_OPTION_ID, name: ALL_CATEGORIES_OPTION_NAME },
                  ...flatCategories.map((category) => ({ id: String(category.id), name: category.name })),
                ]}
                onValueChange={(value, selectedId) => {
                  if (selectedId === ALL_CATEGORIES_OPTION_ID) {
                    setCategorySearch(ALL_CATEGORIES_OPTION_NAME);
                    setProductSearch("");
                    setForm({ ...form, category: "", product: "" });
                    return;
                  }
                  setCategorySearch(value);
                  setProductSearch(selectedId ? "Tất cả sản phẩm trong danh mục" : "");
                  setForm({ ...form, category: selectedId ?? "", product: "" });
                }}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-neutral-600">Sản phẩm áp dụng</span>
              <CouponCombobox
                value={productSearch}
                placeholder={categorySearch === ALL_CATEGORIES_OPTION_NAME ? "Áp dụng cho tất cả sản phẩm" : form.category ? "Nhập hoặc chọn sản phẩm..." : "Chọn danh mục trước"}
                label="sản phẩm"
                disabled={!form.category || categorySearch === ALL_CATEGORIES_OPTION_NAME}
                options={[
                  { id: "", name: "Tất cả sản phẩm trong danh mục" },
                  ...filteredProducts.map((product) => ({ id: product.id, name: product.name })),
                ]}
                onValueChange={(value, selectedId) => {
                  setProductSearch(value);
                  setForm({ ...form, product: selectedId ?? "" });
                }}
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="mb-1 block text-neutral-600">Số lượng mã</span>
                <select className="mb-2 w-full rounded border px-3 py-2" value={form.usage_limit_mode} onChange={(event) => setForm({ ...form, usage_limit_mode: event.target.value as CouponForm["usage_limit_mode"], usage_limit: event.target.value === "unlimited" ? "" : form.usage_limit })}>
                  <option value="unlimited">Không giới hạn</option>
                  <option value="limited">Có giới hạn</option>
                </select>
                {form.usage_limit_mode === "limited" && (
                  <input type="number" min="1" className="w-full rounded border px-3 py-2" value={form.usage_limit} onChange={(event) => setForm({ ...form, usage_limit: event.target.value })} />
                )}
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-neutral-600">Mỗi khách</span>
                <input type="number" min="1" className="w-full rounded border px-3 py-2" value={form.per_customer_limit} onChange={(event) => setForm({ ...form, per_customer_limit: event.target.value })} />
              </label>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-neutral-600">Hết hạn</span>
              <select className="mb-2 w-full rounded border px-3 py-2" value={form.expiry_mode} onChange={(event) => setForm({ ...form, expiry_mode: event.target.value as CouponForm["expiry_mode"], start_at: event.target.value === "forever" ? "" : form.start_at, end_at: event.target.value === "forever" ? "" : form.end_at, duration_days: event.target.value === "forever" ? "" : form.duration_days })}>
                <option value="forever">Vĩnh viễn</option>
                <option value="limited">Có giới hạn</option>
              </select>
              {form.expiry_mode === "limited" && (
                <div className="space-y-2">
                  <label className="block">
                    <span className="mb-1 block text-neutral-600">Ngày bắt đầu</span>
                    <input type="datetime-local" min={minDateTimeLocal()} className="w-full rounded border px-3 py-2" value={form.start_at} onChange={(event) => setForm({ ...form, start_at: event.target.value })} />
                  </label>
                  <select className="w-full rounded border px-3 py-2" value={form.expiry_limit_mode} onChange={(event) => setForm({ ...form, expiry_limit_mode: event.target.value as CouponForm["expiry_limit_mode"], end_at: event.target.value === "duration" ? "" : form.end_at, duration_days: event.target.value === "end_date" ? "" : form.duration_days })}>
                    <option value="end_date">Chọn ngày kết thúc</option>
                    <option value="duration">Chọn thời hạn theo số ngày</option>
                  </select>
                  {form.expiry_limit_mode === "end_date" ? (
                    <label className="block">
                      <span className="mb-1 block text-neutral-600">Ngày kết thúc</span>
                      <input type="datetime-local" min={form.start_at || minDateTimeLocal()} className="w-full rounded border px-3 py-2" value={form.end_at} onChange={(event) => setForm({ ...form, end_at: event.target.value })} />
                    </label>
                  ) : (
                    <div className="space-y-2">
                      <label className="block">
                        <span className="mb-1 block text-neutral-600">Thời gian hiệu lực (số ngày)</span>
                        <input type="number" min="1" className="w-full rounded border px-3 py-2" value={form.duration_days} onChange={(event) => setForm({ ...form, duration_days: event.target.value })} placeholder="VD: 45" />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-neutral-600">Ngày kết thúc tự tính</span>
                        <input
                          className="w-full rounded border bg-neutral-50 px-3 py-2"
                          value={calculateEndDateFromDuration(form.start_at, form.duration_days) || "Chọn ngày bắt đầu và nhập số ngày"}
                          readOnly
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} />
              Đang kích hoạt
            </label>
            <div className="flex gap-2">
              <button disabled={isSaving} className="rounded bg-neutral-950 px-4 py-2 text-white disabled:opacity-60">{isSaving ? "Đang lưu" : "Lưu coupon"}</button>
              <button type="button" className="rounded border px-4 py-2" onClick={() => { setForm(emptyForm); setCategorySearch(""); setProductSearch(""); }}>Làm mới</button>
            </div>
          </form>

          <section className="overflow-x-auto rounded-lg border bg-white p-4">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-neutral-500">
                  <th className="px-2 py-2">Mã</th>
                  <th className="px-2 py-2">Tên coupon</th>
                  <th className="px-2 py-2">Giá trị</th>
                  <th className="px-2 py-2">Phạm vi</th>
                  <th className="px-2 py-2">Đã dùng</th>
                  <th className="px-2 py-2">Hết hạn</th>
                  <th className="px-2 py-2">Trạng thái</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="px-2 py-8 text-center text-neutral-500">Đang lấy dữ liệu...</td>
                  </tr>
                )}
                {!isLoading && coupons.map((coupon) => (
                  <tr key={coupon.coupon_id} className="border-t">
                    <td className="px-2 py-3 font-medium">{coupon.code}</td>
                    <td className="px-2 py-3">{coupon.name || "Chưa đặt tên"}</td>
                    <td className="px-2 py-3">{coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `${Number(coupon.discount_value).toLocaleString("vi-VN")} VND`}</td>
                    <td className="px-2 py-3">{coupon.product_name || coupon.category_name || "Toàn đơn"}</td>
                    <td className="px-2 py-3">{coupon.used_count}/{coupon.usage_limit ?? "không giới hạn"}</td>
                    <td className="px-2 py-3">{coupon.end_at ? new Date(coupon.end_at).toLocaleString("vi-VN") : "Vĩnh viễn"}</td>
                    <td className="px-2 py-3">{coupon.is_active ? "Bật" : "Ẩn"}</td>
                    <td className="px-2 py-3 text-right">
                      <button className="mr-2 rounded border px-2 py-1" onClick={() => {
                        const nextForm = fromCoupon(coupon);
                        setForm(nextForm);
                        const isAllScope = !nextForm.category && !nextForm.product;
                        setCategorySearch(isAllScope ? ALL_CATEGORIES_OPTION_NAME : flatCategories.find((category) => String(category.id) === nextForm.category)?.name ?? "");
                        setProductSearch(isAllScope ? "" : nextForm.product ? products.find((product) => product.id === nextForm.product)?.name ?? "" : nextForm.category ? "Tất cả sản phẩm trong danh mục" : "");
                      }}>Sửa</button>
                      <button className="rounded border border-red-200 px-2 py-1 text-red-700" onClick={() => void removeCoupon(coupon)}>Xóa</button>
                    </td>
                  </tr>
                ))}
                {!isLoading && !coupons.length && (
                  <tr>
                    <td colSpan={8} className="px-2 py-8 text-neutral-500">Chưa có coupon</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        </section>
      </div>
      {isHistoryOpen && (
        <AdminAuditHistoryModal
          title="Lịch sử chỉnh sửa coupon"
          items={historyItems}
          isLoading={isHistoryLoading}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}
    </main>
  );
}

function CouponCombobox({
  value,
  options,
  placeholder,
  label,
  disabled = false,
  onValueChange,
}: {
  value: string;
  options: Array<{ id: string; name: string }>;
  placeholder: string;
  label: string;
  disabled?: boolean;
  onValueChange: (value: string, selectedId: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = showAll
    ? options
    : options.filter((option) => option.name.toLowerCase().includes(normalizedValue));

  function updateValue(nextValue: string) {
    const matched = options.find(
      (option) => option.name.toLowerCase() === nextValue.trim().toLowerCase(),
    );
    onValueChange(nextValue, matched ? matched.id : null);
    setShowAll(false);
    setIsOpen(true);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        disabled={disabled}
        onFocus={() => { setShowAll(true); setIsOpen(true); }}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={(event) => updateValue(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded border px-3 py-2 pr-10 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500"
      />
      <button
        type="button"
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => { setShowAll(true); setIsOpen((current) => !current); }}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-500 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`Mở danh sách ${label}`}
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-56 w-full overflow-y-auto rounded border border-neutral-200 bg-white py-1 shadow-lg">
          {filteredOptions.length ? filteredOptions.map((option) => (
            <button
              key={`${label}-${option.id || "all"}`}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onValueChange(option.name, option.id);
                setShowAll(false);
                setIsOpen(false);
              }}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100"
            >
              {option.name}
            </button>
          )) : (
            <div className="px-3 py-2 text-sm text-neutral-500">Không tìm thấy {label} phù hợp.</div>
          )}
        </div>
      )}
    </div>
  );
}
