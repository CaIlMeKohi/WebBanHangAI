import { useEffect, useState, type FormEvent } from "react";

import { apiDelete, apiGet, apiPost, apiPut } from "../../lib/apiClient";

type CatalogTab = "categories" | "brands" | "variants";
type Row = Record<string, unknown>;

const endpoints: Record<CatalogTab, string> = {
  categories: "/products/admin/categories/",
  brands: "/products/admin/brands/",
  variants: "/products/admin/product-variants/",
};

const labels: Record<CatalogTab, string> = {
  categories: "Danh mục",
  brands: "Thương hiệu",
  variants: "Biến thể / SKU",
};

export function AdminCatalog() {
  const [tab, setTab] = useState<CatalogTab>("categories");
  const [rows, setRows] = useState<Row[]>([]);
  const [editing, setEditing] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});

  async function load(activeTab = tab) {
    const response = await apiGet<Row[] | { results?: Row[] }>(endpoints[activeTab]);
    setRows(Array.isArray(response) ? response : response.results ?? []);
  }

  useEffect(() => {
    setEditing(null);
    setForm({});
    setError("");
    load(tab).catch((caught) =>
      setError(caught instanceof Error ? caught.message : "Không tải được dữ liệu"),
    );
  }, [tab]);

  function startCreate() {
    setEditing(null);
    setForm(
      tab === "categories"
        ? { name: "", slug: "", is_active: "true" }
        : tab === "brands"
          ? { name: "", slug: "", logo_url: "", description: "", is_active: "true" }
          : {
              product: "",
              sku: "",
              color: "",
              size: "",
              price: "",
              stock_quantity: "0",
              stock_reserved: "0",
              low_stock_threshold: "5",
              is_active: "true",
            },
    );
  }

  function startEdit(row: Row) {
    setEditing(row);
    const keys =
      tab === "categories"
        ? ["name", "slug", "is_active"]
        : tab === "brands"
          ? ["name", "slug", "logo_url", "description", "is_active"]
          : ["product", "sku", "color", "size", "price", "stock_quantity", "stock_reserved", "low_stock_threshold", "is_active"];
    setForm(Object.fromEntries(keys.map((key) => [key, String(row[key] ?? "")])));
  }

  function rowId(row: Row) {
    return Number(row.id ?? row.brand_id ?? row.variant_id);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const payload: Record<string, unknown> = { ...form };
    for (const key of ["product", "price", "stock_quantity", "stock_reserved", "low_stock_threshold"]) {
      if (key in payload) payload[key] = Number(payload[key]);
    }
    if ("is_active" in payload) payload.is_active = payload.is_active === "true";
    try {
      if (editing) {
        await apiPut(`${endpoints[tab]}${rowId(editing)}/`, payload);
      } else {
        await apiPost(endpoints[tab], payload);
      }
      setForm({});
      setEditing(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không lưu được dữ liệu");
    }
  }

  async function remove(row: Row) {
    if (!confirm(`Xóa ${labels[tab].toLowerCase()} này?`)) return;
    try {
      await apiDelete(`${endpoints[tab]}${rowId(row)}/`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không xóa được dữ liệu");
    }
  }

  const formOpen = Object.keys(form).length > 0;

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Danh mục, thương hiệu và SKU</h1>
            <p className="text-sm text-neutral-500">Quản lý dữ liệu nền của sản phẩm.</p>
          </div>
          <button onClick={startCreate} className="rounded bg-neutral-950 px-4 py-2 text-white">
            Thêm {labels[tab].toLowerCase()}
          </button>
        </header>

        <div className="flex gap-2">
          {(Object.keys(labels) as CatalogTab[]).map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`rounded border px-4 py-2 ${tab === item ? "bg-neutral-950 text-white" : "bg-white"}`}
            >
              {labels[item]}
            </button>
          ))}
        </div>

        {error && <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {formOpen && (
          <form onSubmit={submit} className="grid gap-3 rounded border bg-white p-4 md:grid-cols-3">
            {Object.entries(form).map(([key, value]) => (
              <label key={key} className="text-sm">
                <span className="mb-1 block font-medium">{fieldLabel(key)}</span>
                {key === "is_active" ? (
                  <select value={value} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="w-full rounded border px-3 py-2">
                    <option value="true">Đang hoạt động</option>
                    <option value="false">Ngừng hoạt động</option>
                  </select>
                ) : (
                  <input
                    required={!["logo_url", "description"].includes(key)}
                    type={["product", "price", "stock_quantity", "stock_reserved", "low_stock_threshold"].includes(key) ? "number" : "text"}
                    value={value}
                    onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                    className="w-full rounded border px-3 py-2"
                  />
                )}
              </label>
            ))}
            <div className="flex items-end gap-2">
              <button type="submit" className="rounded bg-neutral-950 px-4 py-2 text-white">Lưu</button>
              <button type="button" onClick={() => { setForm({}); setEditing(null); }} className="rounded border px-4 py-2">Hủy</button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-100">
              <tr>
                {columnsFor(tab).map((column) => <th key={column} className="px-3 py-2">{fieldLabel(column)}</th>)}
                <th className="px-3 py-2">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowId(row)} className="border-t">
                  {columnsFor(tab).map((column) => (
                    <td key={column} className="max-w-64 truncate px-3 py-2">{formatValue(row[column])}</td>
                  ))}
                  <td className="space-x-2 px-3 py-2">
                    <button onClick={() => startEdit(row)} className="rounded border px-2 py-1">Sửa</button>
                    <button onClick={() => void remove(row)} className="rounded border border-red-300 px-2 py-1 text-red-700">Xóa</button>
                  </td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={columnsFor(tab).length + 1} className="px-3 py-8 text-center text-neutral-500">Chưa có dữ liệu.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

function columnsFor(tab: CatalogTab) {
  if (tab === "categories") return ["id", "name", "slug", "is_active"];
  if (tab === "brands") return ["brand_id", "name", "slug", "is_active"];
  return ["variant_id", "product", "sku", "color", "size", "price", "stock_quantity", "stock_reserved", "is_active"];
}

function fieldLabel(key: string) {
  const values: Record<string, string> = {
    id: "Mã",
    brand_id: "Mã",
    variant_id: "Mã",
    product: "Mã sản phẩm",
    name: "Tên",
    slug: "Slug",
    logo_url: "Logo URL",
    description: "Mô tả",
    sku: "SKU",
    color: "Màu",
    size: "Kích cỡ",
    price: "Giá",
    stock_quantity: "Tồn kho",
    stock_reserved: "Đang giữ",
    low_stock_threshold: "Ngưỡng tồn thấp",
    is_active: "Trạng thái",
  };
  return values[key] ?? key;
}

function formatValue(value: unknown) {
  if (typeof value === "boolean") return value ? "Hoạt động" : "Ngừng";
  return value == null ? "" : String(value);
}
