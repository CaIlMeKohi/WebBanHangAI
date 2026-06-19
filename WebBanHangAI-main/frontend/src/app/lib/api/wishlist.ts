import type { Product } from "../../data/products";
import { apiGet, apiPost } from "../apiClient";

export interface ApiWishlistItem {
  wishlist_item_id: number;
  product: Product;
}

export async function fetchWishlist(
  userId: number,
): Promise<ApiWishlistItem[]> {
  return apiGet<ApiWishlistItem[]>(`/products/wishlist/?user_id=${userId}`);
}

export async function addWishlistItem(
  userId: number,
  productId: number | string,
): Promise<ApiWishlistItem> {
  return apiPost<ApiWishlistItem>(`/products/wishlist/`, {
    user_id: userId,
    product_id: productId,
  });
}
