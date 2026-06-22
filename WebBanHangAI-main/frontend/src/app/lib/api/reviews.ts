import { apiDelete, apiGet, apiPostMultipart } from "../apiClient";

export interface ProductReview {
  review_id: number;
  user_id?: number;
  rating: number;
  comment?: string | null;
  image_urls?: string[];
  created_at?: string;
}

export async function fetchProductReviews(
  productId: string | number,
): Promise<ProductReview[]> {
  return apiGet<ProductReview[]>(`/products/${productId}/reviews`, false);
}

export async function createProductReview(data: {
  product_id: string | number;
  order_item_id?: number;
  rating: number;
  comment: string;
  images?: File[];
}): Promise<{ review_id: number }> {
  const formData = new FormData();
  formData.append("product_id", String(data.product_id));
  if (data.order_item_id) formData.append("order_item_id", String(data.order_item_id));
  formData.append("rating", String(data.rating));
  formData.append("comment", data.comment);
  for (const image of data.images ?? []) {
    formData.append("images", image);
  }
  return apiPostMultipart<{ review_id: number }>(`/reviews/`, formData);
}

export async function deleteProductReview(reviewId: string | number): Promise<void> {
  return apiDelete(`/admin/reviews/${reviewId}`);
}
