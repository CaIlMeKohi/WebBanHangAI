import type { Product } from "../../data/products";
import { apiDelete, apiGet, apiPost } from "../apiClient";

export interface ApiWishlistItem {
  wishlist_item_id: number;
  product: Product;
}

export async function fetchWishlist(
  userId: number,
): Promise<ApiWishlistItem[]> {
  void userId;
  return apiGet<ApiWishlistItem[]>(`/products/wishlist/`);
}

export async function addWishlistItem(
  userId: number,
  productId: number | string,
): Promise<ApiWishlistItem> {
  void userId;
  return apiPost<ApiWishlistItem>(`/products/wishlist/`, {
    product_id: productId,
  });
}

export async function deleteWishlistItem(
  userId: number,
  productId: number | string,
): Promise<void> {
  void userId;
  return apiDelete(`/products/wishlist/${productId}/`);
}
