import type { Product } from "../data/products";

export interface AdminProduct extends Product {
  slug: string;
  base_price?: number;
  stock_quantity: number;
  feature_text: string;
  sale_price?: number | null;
  category_id?: number;
  gender?: "men" | "women" | "unisex";
  brand_id?: number | null;
  image_url?: string;
  is_new?: boolean;
  is_bestseller?: boolean;
}
