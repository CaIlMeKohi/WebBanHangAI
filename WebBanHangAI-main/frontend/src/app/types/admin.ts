import type { Product } from "../data/products";

export interface AdminProduct extends Omit<Product, "variants"> {
  slug: string;
  base_price?: number;
  stock_quantity: number;
  feature_text: string;
  category_id?: number;
  gender?: "men" | "women" | "unisex";
  brand_id?: number | null;
  image_url?: string;
  is_new?: boolean;
  is_bestseller?: boolean;
  variants?: Array<{
    variant_id?: number;
    size: string;
    color?: string;
    stock_quantity: number;
    is_active?: boolean;
  }>;
}
