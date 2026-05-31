import { useEffect, useState } from "react";
import { AlertCircle, Edit2, Plus, Trash2 } from "lucide-react";

import {
  deleteAdminProduct,
  fetchAdminProducts,
  fetchCategories,
} from "../../lib/api";
import type { CategoryNode } from "../../data/products";
import { getAdminProductPrice } from "../../lib/adminProducts";
import type { AdminProduct } from "../../types/admin";
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

  useEffect(() => {
    loadProducts();
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
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteAdminProduct(id);
      setProducts(products.filter((product) => product.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete product");
    }
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingProduct(null);
  }

  function handleFormSuccess() {
    handleFormClose();
    loadProducts();
  }

  function formatCurrency(value: number | string | null | undefined) {
    return Number(value ?? 0).toLocaleString("vi-VN");
  }

  const flatCategories = categories.flatMap((category) => [
    category,
    ...(category.children ?? []),
  ]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const visibleProducts = products.filter((product) => {
    const matchesCategory = selectedCategory
      ? product.category === selectedCategory ||
        product.subcategory === selectedCategory
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

  const countProducts = (category: CategoryNode) =>
    products.filter(
      (product) =>
        product.category === category.slug ||
        product.subcategory === category.slug,
    ).length;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-light">Product Management</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Quản lý toàn bộ sản phẩm, rồi lọc theo category nếu cần.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingProduct(null);
            setShowForm(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-white transition-colors hover:bg-neutral-800"
        >
          <Plus className="h-5 w-5" />
          Add Product
        </button>
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
          <p className="text-neutral-600">Loading products...</p>
        </div>
      ) : (
        <>
          <section className="mb-6 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
            <button
              onClick={() => setSelectedCategory(null)}
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
                onClick={() => setSelectedCategory(category.slug)}
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
                Chưa có category từ DB
              </div>
            )}
          </section>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px]">
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Tìm kiếm sản phẩm theo tên, mã, category..."
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

          {selectedCategory ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm text-neutral-500">
                  {visibleProducts.length} sản phẩm trong loại này
                </div>
                <button
                  className="rounded border px-3 py-2 text-sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  Xem tất cả
                </button>
              </div>

              <ProductTable
                products={visibleProducts}
                formatCurrency={formatCurrency}
                onEdit={(product) => {
                  setEditingProduct(product);
                  setShowForm(true);
                }}
                onDelete={handleDelete}
              />
            </>
          ) : (
            <ProductTable
              products={visibleProducts}
              formatCurrency={formatCurrency}
              onEdit={(product) => {
                setEditingProduct(product);
                setShowForm(true);
              }}
              onDelete={handleDelete}
            />
          )}
        </>
      )}
    </div>
  );
}

function ProductTable({
  products,
  formatCurrency,
  onEdit,
  onDelete,
}: {
  products: AdminProduct[];
  formatCurrency: (value: number | string | null | undefined) => string;
  onEdit: (product: AdminProduct) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="px-4 py-3 text-left font-medium">Image</th>
            <th className="px-4 py-3 text-left font-medium">Name</th>
            <th className="px-4 py-3 text-left font-medium">Price</th>
            <th className="px-4 py-3 text-left font-medium">Stock</th>
            <th className="px-4 py-3 text-left font-medium">Category</th>
            <th className="px-4 py-3 text-left font-medium">Actions</th>
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
                      No image
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 font-medium">{product.name}</td>
              <td className="px-4 py-3">
                {formatCurrency(getAdminProductPrice(product))}đ
              </td>
              <td className="px-4 py-3">
                {product.stock_quantity ?? product.stockQuantity ?? "N/A"}
              </td>
              <td className="px-4 py-3">
                {product.subcategory ?? product.subcategoryName ?? "N/A"}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => onEdit(product)}
                    className="rounded p-2 text-blue-600 transition-colors hover:bg-blue-50"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDelete(product.id)}
                    className="rounded p-2 text-red-600 transition-colors hover:bg-red-50"
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
          <p className="text-neutral-600">No products found</p>
        </div>
      )}
    </div>
  );
}
