import type { AdminProduct } from "../types/admin";

export interface AdminProductFormState {
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

export function createAdminProductFormState(
  product?: AdminProduct | null,
): AdminProductFormState {
  return {
    name: product?.name || "",
    slug: product?.slug || "",
    description: product?.description || "",
    price: product?.base_price ?? product?.originalPrice ?? product?.price ?? 0,
    sale_price: product?.sale_price ?? null,
    stock_quantity: product?.stock_quantity || 0,
    category_id: product?.category_id ?? 1,
    brand_id: product?.brand_id ?? 1,
    feature_text: product?.feature_text || "",
  };
}

export function appendAdminProductFormData(
  payload: FormData,
  formData: AdminProductFormState,
  imageFile: File | null,
) {
  payload.append("name", formData.name);
  payload.append("slug", formData.slug);
  payload.append("description", formData.description);
  payload.append("base_price", String(formData.price));

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
}

export function getAdminProductPrice(product: AdminProduct) {
  return product.base_price ?? product.price;
}