import { useEffect, useMemo, useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { createAdminProduct, fetchBrands, fetchCategories, updateAdminProduct, type BrandOption } from "../../lib/api";
import type { AdminProduct } from "../../types/admin";
import type { CategoryNode } from "../../data/products";
import {
  appendAdminProductFormData,
  createAdminProductFormState,
  type AdminProductFormState,
} from "../../lib/adminProducts";

interface ProductAdminFormProps {
  product?: AdminProduct | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProductAdminForm({
  product,
  onClose,
  onSuccess,
}: ProductAdminFormProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(
    product?.image || "",
  );
  const [formData, setFormData] = useState<AdminProductFormState>(
    createAdminProductFormState(product),
  );
  const [categories, setCategories] = useState<CategoryNode[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setImagePreview(product?.image || "");
    setImageFile(null);
  }, [product]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([fetchCategories(), fetchBrands()])
      .then(([categoryItems, brandItems]) => {
        if (!isMounted) return;
        setCategories(
          categoryItems
            .flatMap((item) => (item.children?.length ? item.children : [item]))
            .filter((item) => typeof item.id === "number"),
        );
        setBrands(brandItems);
      })
      .catch(() => {
        if (isMounted) {
          setCategories([]);
          setBrands([]);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!categories.length) return;
    const hasSelectedCategory = categories.some(
      (category) => category.id === formData.category_id,
    );
    if (!hasSelectedCategory && typeof categories[0].id === "number") {
      setFormData((current) => ({
        ...current,
        category_id: categories[0].id as number,
      }));
    }
  }, [categories, formData.category_id]);

  useEffect(() => {
    if (!brands.length || formData.brand_id) return;
    const firstBrandId = brands[0].brand_id ?? brands[0].id;
    if (typeof firstBrandId === "number") {
      setFormData((current) => ({ ...current, brand_id: firstBrandId }));
    }
  }, [brands, formData.brand_id]);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    const type = e.target instanceof HTMLInputElement ? e.target.type : "";
    const checked =
      e.target instanceof HTMLInputElement ? e.target.checked : false;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          :
        name === "price" ||
        name === "sale_price" ||
        name === "stock_quantity" ||
        name === "category_id" ||
        name === "brand_id"
          ? value === ""
            ? null
            : Number(value)
          : value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);

    if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImagePreview(file ? URL.createObjectURL(file) : product?.image || "");
  };

  const isCreating = !product;
  const submitLabel = useMemo(
    () =>
      isLoading
        ? "Đang lưu..."
        : product
          ? "Cập nhật sản phẩm"
          : "Tạo sản phẩm",
    [isLoading, product],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload = new FormData();
      appendAdminProductFormData(payload, formData, imageFile, isCreating);

      if (product) {
        await updateAdminProduct(product.id, payload);
      } else {
        if (!imageFile && isCreating)
          throw new Error("Vui lòng chọn ảnh từ máy tính");
        await createAdminProduct(payload);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu sản phẩm");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 flex items-center justify-between p-6">
          <h2 className="text-2xl font-light">
            {product ? "Sửa sản phẩm" : "Thêm sản phẩm mới"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
            aria-label="Đóng"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-800">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Tên sản phẩm *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Slug *</label>
              <input
                type="text"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Mô tả *</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={3}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Giá *</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                required
                min="0"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Giá khuyến mãi
              </label>
              <input
                type="number"
                name="sale_price"
                value={formData.sale_price || ""}
                onChange={handleChange}
                min="0"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Tồn kho *
              </label>
              <input
                type="number"
                name="stock_quantity"
                value={formData.stock_quantity}
                onChange={handleChange}
                required
                min="0"
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Danh mục *
              </label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Gioi tinh *
              </label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                <option value="unisex">Unisex</option>
                <option value="men">Do nam</option>
                <option value="women">Do nu</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Thương hiệu
              </label>
              <select
                name="brand_id"
                value={formData.brand_id || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                <option value="">Chọn thương hiệu</option>
                {brands.map((brand) => (
                  <option key={brand.brand_id ?? brand.id} value={brand.brand_id ?? brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Mô tả nổi bật
            </label>
            <input
              type="text"
              name="feature_text"
              value={formData.feature_text}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>

          <div className="rounded-lg border border-neutral-200 p-4">
            <label className="flex items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                name="is_new"
                checked={isCreating ? true : formData.is_new}
                onChange={handleChange}
                disabled={isCreating}
                className="h-4 w-4 rounded border-neutral-300"
              />
              Sản phẩm mới
            </label>
            {isCreating && (
              <p className="mt-2 text-xs text-neutral-500">
                Sản phẩm mới tạo sẽ tự động được đánh dấu là sản phẩm mới.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Ảnh sản phẩm {product ? "(để trống nếu không đổi)" : "*"}
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              required={isCreating}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Xem trước"
                className="mt-2 max-w-xs max-h-48 rounded-lg object-cover"
              />
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {submitLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-neutral-300 rounded-lg hover:bg-neutral-50 transition-colors"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
