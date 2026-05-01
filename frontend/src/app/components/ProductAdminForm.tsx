import { useEffect, useMemo, useState } from "react";
import { X, AlertCircle } from "lucide-react";
import { createAdminProduct, updateAdminProduct } from "../lib/api";
import type { AdminProduct } from "../types/admin";

interface ProductAdminFormProps {
  product?: AdminProduct | null;
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  name: string;
  slug: string;
  description: string;
  price: number;
  sale_price: number | null;
  stock_quantity: number;
  category_id: number;
  brand_id: number | null;
  feature_text: string;
}

const CATEGORIES = [
  { id: 1, name: "Ao Thun", slug: "ao-thun" },
  { id: 2, name: "Ao Len", slug: "ao-len" },
  { id: 3, name: "Quan", slug: "quan" },
  { id: 4, name: "Ao Khoac", slug: "ao-khoac" },
  { id: 5, name: "Vay", slug: "vay" },
  { id: 6, name: "Ao So Mi", slug: "ao-so-mi" },
  { id: 7, name: "Giay", slug: "giay" },
];

const BRANDS = [
  { id: 1, name: "Essence Basics" },
  { id: 2, name: "Essence Studio" },
];

export function ProductAdminForm({
  product,
  onClose,
  onSuccess,
}: ProductAdminFormProps) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(
    product?.image || "",
  );
  const [formData, setFormData] = useState<FormData>({
    name: product?.name || "",
    slug: product?.slug || "",
    description: product?.description || "",
    price: product?.originalPrice || product?.price || 0,
    sale_price: product?.originalPrice ? product?.price : null,
    stock_quantity: product?.stock_quantity || 0,
    category_id: 1,
    brand_id: 1,
    feature_text: product?.feature_text || "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setImagePreview(product?.image || "");
    setImageFile(null);
  }, [product]);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
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

    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }

    if (file) {
      setImagePreview(URL.createObjectURL(file));
    } else {
      setImagePreview(product?.image || "");
    }
  };

  const isCreating = !product;
  const submitLabel = useMemo(
    () =>
      isLoading ? "Saving..." : product ? "Update Product" : "Create Product",
    [isLoading, product],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const payload = new FormData();
      payload.append("name", formData.name);
      payload.append("slug", formData.slug);
      payload.append("description", formData.description);
      payload.append("price", String(formData.price));
      if (formData.sale_price !== null && formData.sale_price !== undefined) {
        payload.append("sale_price", String(formData.sale_price));
      }
      payload.append("stock_quantity", String(formData.stock_quantity));
      payload.append("category_id", String(formData.category_id));
      if (formData.brand_id !== null && formData.brand_id !== undefined) {
        payload.append("brand_id", String(formData.brand_id));
      }
      payload.append("feature_text", formData.feature_text);
      if (imageFile) {
        payload.append("image_file", imageFile);
      }

      if (product) {
        await updateAdminProduct(product.id, payload);
      } else {
        if (!imageFile && isCreating) {
          throw new Error("Vui lòng chọn ảnh từ máy tính");
        }
        await createAdminProduct(payload);
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-200 flex items-center justify-between p-6">
          <h2 className="text-2xl font-light">
            {product ? "Edit Product" : "Add New Product"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
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
                Product Name *
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
            <label className="block text-sm font-medium mb-2">
              Description *
            </label>
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
              <label className="block text-sm font-medium mb-2">Price *</label>
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
                Sale Price
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
              <label className="block text-sm font-medium mb-2">Stock *</label>
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
                Category *
              </label>
              <select
                name="category_id"
                value={formData.category_id}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Brand</label>
              <select
                name="brand_id"
                value={formData.brand_id || ""}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                <option value="">Select Brand</option>
                {BRANDS.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Feature Text
            </label>
            <input
              type="text"
              name="feature_text"
              value={formData.feature_text}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
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
                alt="Preview"
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
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
