import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Edit2, History, Plus, Trash2, X } from "lucide-react";

import {
  deleteAdminProduct,
  fetchAdminAuditLogs,
  fetchAdminProductHistory,
  fetchAdminProducts,
  fetchCategories,
  type AdminProductHistoryItem,
} from "../../lib/api";
import type { CategoryNode } from "../../data/products";
import { getAdminProductPrice } from "../../lib/adminProducts";
import type { AdminProduct } from "../../types/admin";
import { AdminAuditHistoryModal } from "./AdminAuditHistoryModal";
import { ProductAdminForm } from "./ProductAdminForm";

export function ProductAdmin() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(
    null,
  );
  const [historyProduct, setHistoryProduct] = useState<AdminProduct | null>(null);
  const [historyItems, setHistoryItems] = useState<AdminProductHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [globalHistoryItems, setGlobalHistoryItems] = useState<AdminProductHistoryItem[]>([]);
  const [isGlobalHistoryOpen, setIsGlobalHistoryOpen] = useState(false);
  const [isGlobalHistoryLoading, setIsGlobalHistoryLoading] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    void loadProducts();
    fetchCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  async function loadProducts() {
    try {
      setIsLoading(true);
      setProducts(await fetchAdminProducts());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được sản phẩm");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Bạn có chắc muốn xóa sản phẩm này không?")) return;
    try {
      await deleteAdminProduct(id);
      setProducts(products.filter((product) => product.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được sản phẩm");
    }
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingProduct(null);
  }

  function handleFormSuccess() {
    handleFormClose();
    void loadProducts();
  }

  async function openHistory(product: AdminProduct) {
    setHistoryProduct(product);
    setHistoryItems([]);
    setIsHistoryLoading(true);
    try {
      setHistoryItems(await fetchAdminProductHistory(product.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được lịch sử sản phẩm");
    } finally {
      setIsHistoryLoading(false);
    }
  }

  async function openGlobalHistory() {
    setIsGlobalHistoryOpen(true);
    setGlobalHistoryItems([]);
    setIsGlobalHistoryLoading(true);
    try {
      setGlobalHistoryItems(await fetchAdminAuditLogs({ entity_type: "product" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được lịch sử chỉnh sửa");
    } finally {
      setIsGlobalHistoryLoading(false);
    }
  }

  function formatCurrency(value: number | string | null | undefined) {
    return Number(value ?? 0).toLocaleString("vi-VN");
  }

  const flatCategories = flattenCategories(categories);
  const normalizedSearch = searchTerm.trim().toLowerCase();

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, searchTerm]);

  const visibleProducts = products.filter((product) => {
    const selectedCategorySlugs = selectedCategory
      ? getCategoryAndDescendantSlugs(categories, selectedCategory)
      : [];
    const matchesCategory = selectedCategory
      ? selectedCategorySlugs.includes(product.category) ||
        selectedCategorySlugs.includes(product.subcategory)
      : true;
    const matchesSearch = normalizedSearch
      ? [
          product.name,
          product.slug,
          product.categoryName,
          product.subcategoryName,
          product.feature_text,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedSearch),
          )
      : true;

    return matchesCategory && matchesSearch;
  });

  const pageSize = 30;
  const totalPages = Math.max(1, Math.ceil(visibleProducts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedProducts = useMemo(
    () => visibleProducts.slice((safePage - 1) * pageSize, safePage * pageSize),
    [visibleProducts, safePage],
  );

  const countProducts = (category: CategoryNode) => {
    const categorySlugs = getCategoryAndDescendantSlugs([category], category.slug);
    return products.filter(
      (product) =>
        categorySlugs.includes(product.category) ||
        categorySlugs.includes(product.subcategory),
    ).length;
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light">Quản lý sản phẩm</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Quản lý toàn bộ sản phẩm và lọc theo danh mục khi cần.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
        <button
          onClick={openGlobalHistory}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 transition-colors hover:bg-neutral-50"
        >
          <History className="h-5 w-5" />
          Xem lịch sử chỉnh sửa
        </button>
        <button
          onClick={() => {
            setEditingProduct(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-white transition-colors hover:bg-neutral-800"
        >
          <Plus className="h-5 w-5" />
          Thêm sản phẩm
        </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="h-5 w-5 text-red-600" />
          <span className="text-red-800">{error}</span>
        </div>
      )}

      {showForm && (
        <ProductAdminForm
          product={editingProduct}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {isLoading ? (
        <div className="py-12 text-center">
          <p className="text-neutral-600">Đang tải sản phẩm...</p>
        </div>
      ) : (
        <>
          <section className="mb-6 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <button
              onClick={() => { setSelectedCategory(null); setPage(1); }}
              className={`rounded-lg border p-4 text-left transition-colors ${
                selectedCategory === null
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "bg-white hover:border-neutral-950"
              }`}
            >
              <div className="text-base font-medium">Tất cả sản phẩm</div>
              <div className="mt-1 text-sm opacity-80">
                {products.length} sản phẩm
              </div>
            </button>
            {flatCategories.map((category) => (
              <button
                key={category.slug}
                onClick={() => { setSelectedCategory(category.slug); setPage(1); }}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  selectedCategory === category.slug
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "bg-white hover:border-neutral-950"
                }`}
              >
                <div className="text-base font-medium">{category.name}</div>
                <div className="mt-1 text-sm opacity-80">
                  {countProducts(category)} sản phẩm
                </div>
              </button>
            ))}
            {flatCategories.length === 0 && (
              <div className="rounded-lg border bg-white p-4 text-neutral-500">
                Chưa có danh mục từ DB
              </div>
            )}
          </section>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="min-w-[240px] flex-1">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm kiếm sản phẩm theo tên, mã, danh mục..."
                className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-neutral-950"
              />
            </div>
            <button
              className="rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-neutral-50"
              onClick={() => setSearchTerm("")}
              disabled={!searchTerm}
            >
              Xóa tìm kiếm
            </button>
          </div>

          <>
            <ProductTable
              products={pagedProducts}
              formatCurrency={formatCurrency}
              onEdit={(product) => {
                setEditingProduct(product);
                setShowForm(true);
              }}
              onDelete={handleDelete}
              onHistory={openHistory}
            />
            <Pagination
              page={safePage}
              totalPages={totalPages}
              totalItems={visibleProducts.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        </>
      )}
      {historyProduct && (
        <ProductHistoryModal
          product={historyProduct}
          items={historyItems}
          isLoading={isHistoryLoading}
          onClose={() => setHistoryProduct(null)}
        />
      )}
      {isGlobalHistoryOpen && (
        <AdminAuditHistoryModal
          title="Lịch sử chỉnh sửa sản phẩm"
          items={globalHistoryItems}
          isLoading={isGlobalHistoryLoading}
          onClose={() => setIsGlobalHistoryOpen(false)}
        />
      )}
    </div>
  );
}

function ProductTable({
  products,
  formatCurrency,
  onEdit,
  onDelete,
  onHistory,
}: {
  products: AdminProduct[];
  formatCurrency: (value: number | string | null | undefined) => string;
  onEdit: (product: AdminProduct) => void;
  onDelete: (id: string) => void;
  onHistory: (product: AdminProduct) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="px-4 py-3 text-left font-medium">Ảnh</th>
            <th className="px-4 py-3 text-left font-medium">Tên sản phẩm</th>
            <th className="px-4 py-3 text-left font-medium">Giá</th>
            <th className="px-4 py-3 text-left font-medium">Tồn kho</th>
            <th className="px-4 py-3 text-left font-medium">Danh mục</th>
            <th className="px-4 py-3 text-left font-medium">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr
              key={product.id ?? product.slug}
              className="border-b border-neutral-200 hover:bg-neutral-50"
            >
              <td className="px-4 py-3">
                <div className="h-14 w-14 overflow-hidden rounded-lg border bg-neutral-100">
                  {product.image || product.image_url ? (
                    <img
                      src={product.image || product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-neutral-400">
                      Chưa có ảnh
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 font-medium">{product.name}</td>
              <td className="px-4 py-3">
                {formatCurrency(getAdminProductPrice(product))}đ
              </td>
              <td className="px-4 py-3">
                {product.stock_quantity ?? product.stockQuantity ?? "Không có"}
              </td>
              <td className="px-4 py-3">
                {product.subcategoryName ?? product.categoryName ?? "Không có"}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => onHistory(product)}
                    className="rounded p-2 text-neutral-600 transition-colors hover:bg-neutral-100"
                    title="Xem lịch sử"
                  >
                    <History className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onEdit(product)}
                    className="rounded p-2 text-blue-600 transition-colors hover:bg-blue-50"
                    title="Sửa sản phẩm"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(product.id)}
                    className="rounded p-2 text-red-600 transition-colors hover:bg-red-50"
                    title="Xóa sản phẩm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {products.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-neutral-600">Không tìm thấy sản phẩm</p>
        </div>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems <= pageSize) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <div className="text-neutral-500">
        Trang {page}/{totalPages} · Hiển thị tối đa {pageSize} sản phẩm mỗi trang
      </div>
      <div className="flex gap-2">
        <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Trước
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }).map((_, index) => {
          const nextPage = index + 1;
          return (
            <button
              key={nextPage}
              className={`rounded border px-3 py-2 ${nextPage === page ? "bg-neutral-950 text-white" : ""}`}
              onClick={() => onPageChange(nextPage)}
            >
              {nextPage}
            </button>
          );
        })}
        <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Sau
        </button>
      </div>
    </div>
  );
}

function ProductHistoryModal({
  product,
  items,
  isLoading,
  onClose,
}: {
  product: AdminProduct;
  items: AdminProductHistoryItem[];
  isLoading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-neutral-200 p-5">
          <div>
            <h2 className="text-xl font-semibold">Lịch sử sản phẩm</h2>
            <p className="mt-1 text-sm text-neutral-500">{product.name}</p>
          </div>
          <button className="rounded p-2 hover:bg-neutral-100" onClick={onClose} aria-label="Đóng lịch sử">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {isLoading ? (
            <div className="py-10 text-center text-sm text-neutral-500">Đang tải lịch sử...</div>
          ) : items.length > 0 ? (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.audit_id} className="rounded-lg border border-neutral-200 p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-medium">{productActionLabel(item.action)}</div>
                    <div className="text-xs text-neutral-500">
                      {new Date(item.created_at).toLocaleString("vi-VN")}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    Người thao tác: {item.actor_email || "Không rõ"}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {item.old_value && (
                      <HistoryJsonBlock title="Trước khi sửa/xóa" value={item.old_value} />
                    )}
                    {item.metadata && (
                      <HistoryJsonBlock title="Thông tin ghi nhận" value={item.metadata} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-neutral-500">
              Chưa có lịch sử thao tác cho sản phẩm này.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HistoryJsonBlock({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <div className="rounded bg-neutral-50 p-3">
      <div className="mb-2 text-xs font-medium text-neutral-600">{title}</div>
      <pre className="whitespace-pre-wrap break-words text-xs text-neutral-700">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function productActionLabel(action: string) {
  const labels: Record<string, string> = {
    create_product: "Tạo sản phẩm",
    update_product: "Cập nhật sản phẩm",
    delete_product: "Xóa sản phẩm",
  };
  return labels[action] ?? action;
}

function flattenCategories(categories: CategoryNode[]): CategoryNode[] {
  return categories.flatMap((category) => [
    category,
    ...flattenCategories(category.children ?? []),
  ]);
}

function getCategoryAndDescendantSlugs(
  categories: CategoryNode[],
  slug: string,
): string[] {
  const category = findCategoryBySlug(categories, slug);
  if (!category) return [slug];
  return flattenCategories([category]).map((item) => item.slug);
}

function findCategoryBySlug(
  categories: CategoryNode[],
  slug: string,
): CategoryNode | undefined {
  for (const category of categories) {
    if (category.slug === slug) return category;
    const childMatch = findCategoryBySlug(category.children ?? [], slug);
    if (childMatch) return childMatch;
  }
  return undefined;
}
