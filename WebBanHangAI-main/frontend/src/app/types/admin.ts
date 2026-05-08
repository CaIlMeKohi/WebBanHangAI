import type { Product } from "../data/products";

export interface AdminProduct extends Product {
  slug: string;
  stock_quantity: number;
  feature_text: string;
  sale_price?: number | null;
  category_id?: number;
  brand_id?: number | null;
  image_url?: string;
}
