import type { AdminProduct } from "../types/admin";

export interface AdminProductFormState {
  name: string;
  slug: string;
  description: string;
  price: number;
  stock_quantity: number;
  category_id: number | null;
  gender: "men" | "women" | "unisex";
  brand_id: number | null;
  feature_text: string;
  is_new: boolean;
  is_bestseller: boolean;
  variants: Array<{ size: string; stock_quantity: number }>;
}

export const ADMIN_PRODUCT_CATEGORIES = [
  { id: 1, name: "Áo thun", slug: "ao-thun" },
  { id: 2, name: "Áo len", slug: "ao-len" },
  { id: 3, name: "Quần", slug: "quan" },
  { id: 4, name: "Áo khoác", slug: "ao-khoac" },
  { id: 5, name: "Váy", slug: "vay" },
  { id: 6, name: "Áo sơ mi", slug: "ao-so-mi" },
  { id: 7, name: "Giày", slug: "giay" },
] as const;

export const ADMIN_PRODUCT_BRANDS = [
  { id: 1, name: "Essence Basics" },
  { id: 2, name: "Essence Studio" },
] as const;

export function formatMoneyInput(value: number | string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("vi-VN") : "";
}

export function parseMoneyInput(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

export function createAdminProductFormState(
  product?: AdminProduct | null,
): AdminProductFormState {
  return {
    name: product?.name || "",
    slug: product?.slug || "",
    description: product?.description || "",
    price: product?.base_price ?? product?.originalPrice ?? product?.price ?? 0,
    stock_quantity: product?.stock_quantity || 0,
    category_id: product?.category_id ?? null,
    gender: product?.gender ?? "unisex",
    brand_id: product?.brand_id ?? null,
    feature_text: product?.feature_text || "",
    is_new: product?.is_new ?? product?.isNew ?? !product,
    is_bestseller: product?.is_bestseller ?? product?.isBestSeller ?? false,
    variants:
      product?.variants?.filter((variant) => variant.is_active !== false).map((variant) => ({
        size: variant.size,
        stock_quantity: variant.stock_quantity,
      })) ?? [{ size: "STD", stock_quantity: product?.stock_quantity || 0 }],
  };
}

export function appendAdminProductFormData(
  payload: FormData,
  formData: AdminProductFormState,
  imageFile: File | null,
  isCreating = false,
) {
  payload.append("name", formData.name);
  payload.append("slug", formData.slug);
  payload.append("description", formData.description);
  payload.append("base_price", String(formData.price));

  const totalStock = formData.variants.reduce((sum, variant) => sum + Number(variant.stock_quantity || 0), 0);
  payload.append("stock_quantity", String(totalStock));
  payload.append("variants", JSON.stringify(formData.variants));
  if (formData.category_id !== null) {
    payload.append("category_id", String(formData.category_id));
  }
  payload.append("gender", formData.gender);

  if (formData.brand_id !== null && formData.brand_id !== undefined) {
    payload.append("brand_id", String(formData.brand_id));
  }

  payload.append("feature_text", formData.feature_text);
  payload.append("is_new", String(isCreating ? true : formData.is_new));
  payload.append("is_bestseller", String(formData.is_bestseller));

  if (imageFile) {
    payload.append("image_file", imageFile);
  }
}

export function getAdminProductPrice(product: AdminProduct) {
  return product.base_price ?? product.price;
}
