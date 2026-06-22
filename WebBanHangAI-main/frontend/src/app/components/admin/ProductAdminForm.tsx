import { useEffect, useMemo, useState } from "react";
import { X, AlertCircle, ChevronDown, Plus, Trash2 } from "lucide-react";
import { createAdminProduct, fetchBrands, fetchCategories, updateAdminProduct, type BrandOption } from "../../lib/api";
import type { AdminProduct } from "../../types/admin";
import type { CategoryNode } from "../../data/products";
import {
  appendAdminProductFormData,
  createAdminProductFormState,
  formatMoneyInput,
  parseMoneyInput,
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
  const [categorySearch, setCategorySearch] = useState("");
  const [brandSearch, setBrandSearch] = useState("");
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
    const selectedCategory = categories.find(
      (category) => category.id === formData.category_id,
    );
    if (selectedCategory) setCategorySearch(selectedCategory.name);
  }, [categories, formData.category_id]);

  useEffect(() => {
    const selectedBrand = brands.find(
      (brand) => (brand.brand_id ?? brand.id) === formData.brand_id,
    );
    if (selectedBrand) setBrandSearch(selectedBrand.name);
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

  const updateVariant = (index: number, field: "size" | "stock_quantity", value: string) => {
    setFormData((current) => ({
      ...current,
      variants: current.variants.map((variant, variantIndex) =>
        variantIndex === index
          ? { ...variant, [field]: field === "stock_quantity" ? Math.max(0, Number(value)) : value }
          : variant,
      ),
    }));
  };

  const addVariant = () => {
    setFormData((current) => ({
      ...current,
      variants: [...current.variants, { size: "", stock_quantity: 0 }],
    }));
  };

  const removeVariant = (index: number) => {
    setFormData((current) => ({
      ...current,
      variants: current.variants.filter((_, variantIndex) => variantIndex !== index),
    }));
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
    if (!formData.category_id) {
      setError("Vui lòng chọn một danh mục có trong danh sách gợi ý");
      return;
    }
    if (!formData.brand_id) {
      setError("Vui lòng chọn một thương hiệu có trong danh sách");
      return;
    }
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

          <div>
            <div>
              <label className="block text-sm font-medium mb-2">Giá *</label>
              <input
                type="text"
                inputMode="numeric"
                name="price"
                value={formatMoneyInput(formData.price)}
                onChange={(event) => setFormData((current) => ({ ...current, price: parseMoneyInput(event.target.value) }))}
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium">Size và tồn kho *</h3>
                <p className="mt-1 text-xs text-neutral-500">Mỗi size tương ứng với một biến thể trong kho.</p>
              </div>
              <button type="button" onClick={addVariant} className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-neutral-50">
                <Plus className="h-4 w-4" /> Thêm size
              </button>
            </div>
            <div className="space-y-3">
              {formData.variants.map((variant, index) => (
                <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                  <label className="text-sm">Size<input required value={variant.size} onChange={(event) => updateVariant(index, "size", event.target.value)} placeholder="VD: S, M, L, 39" className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 uppercase" /></label>
                  <label className="text-sm">Tồn kho<input required type="number" min="0" value={variant.stock_quantity} onChange={(event) => updateVariant(index, "stock_quantity", event.target.value)} className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2" /></label>
                  <button type="button" onClick={() => removeVariant(index)} disabled={formData.variants.length === 1} className="rounded-lg border border-red-200 p-2.5 text-red-600 disabled:opacity-40" aria-label="Xóa size"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <div className="mt-3 text-sm text-neutral-600">Tổng tồn kho: <strong>{formData.variants.reduce((sum, variant) => sum + Number(variant.stock_quantity || 0), 0)}</strong></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Danh mục *
              </label>
              <AutocompleteCombobox
                value={categorySearch}
                options={categories.flatMap((category) =>
                  typeof category.id === "number" ? [{ id: category.id, name: category.name }] : [],
                )}
                placeholder="Nhập hoặc chọn danh mục..."
                label="danh mục"
                onValueChange={(value, selectedId) => {
                  setCategorySearch(value);
                  setFormData((current) => ({ ...current, category_id: selectedId }));
                }}
              />
              {categorySearch && !formData.category_id && (
                <p className="mt-1 text-xs text-amber-700">Hãy chọn một danh mục có trong danh sách gợi ý.</p>
              )}
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
                Thương hiệu *
              </label>
              <AutocompleteCombobox
                value={brandSearch}
                options={brands.flatMap((brand) => {
                  const id = brand.brand_id ?? brand.id;
                  return typeof id === "number" ? [{ id, name: brand.name }] : [];
                })}
                placeholder="Nhập hoặc chọn thương hiệu..."
                label="thương hiệu"
                onValueChange={(value, selectedId) => {
                  setBrandSearch(value);
                  setFormData((current) => ({ ...current, brand_id: selectedId }));
                }}
              />
              {brandSearch && !formData.brand_id && (
                <p className="mt-1 text-xs text-amber-700">Hãy chọn một thương hiệu có trong danh sách gợi ý.</p>
              )}
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

function AutocompleteCombobox({
  value,
  options,
  placeholder,
  label,
  onValueChange,
}: {
  value: string;
  options: Array<{ id: number; name: string }>;
  placeholder: string;
  label: string;
  onValueChange: (value: string, selectedId: number | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = options.filter((option) =>
    option.name.toLowerCase().includes(normalizedValue),
  );

  function updateValue(nextValue: string) {
    const matched = options.find(
      (option) => option.name.toLowerCase() === nextValue.trim().toLowerCase(),
    );
    onValueChange(nextValue, matched?.id ?? null);
    setIsOpen(true);
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onFocus={() => setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
        onChange={(event) => updateValue(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-neutral-900"
      />
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsOpen((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-neutral-500 hover:text-neutral-900"
        aria-label={`Mở danh sách ${label}`}
      >
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute left-0 top-full z-40 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          {filteredOptions.length ? filteredOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onValueChange(option.name, option.id);
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
