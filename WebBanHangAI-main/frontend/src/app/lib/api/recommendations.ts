import type { Product } from "../../data/products";
import { apiGet, apiPost } from "../apiClient";

export async function recordProductEvent(data: {
  user_id?: number | null;
  product_id: number | string;
  interaction_type: string;
  session_id?: string;
  search_query?: string;
  score?: number;
}) {
  return apiPost(`/products/events/`, data);
}

export async function fetchForYouRecommendations(
  userId?: string,
  limitOrSession: number | string = 8,
  maybeLimitOrSession?: number | string,
  search?: string,
): Promise<Product[]> {
  let limit = 8;
  let sessionId = "guest-demo";

  if (typeof limitOrSession === "number") {
    limit = limitOrSession;
    if (typeof maybeLimitOrSession === "string") {
      sessionId = maybeLimitOrSession;
    }
  } else {
    sessionId = limitOrSession;
    if (typeof maybeLimitOrSession === "number") {
      limit = maybeLimitOrSession;
    }
  }

  const params = new URLSearchParams({ limit: String(limit) });
  if (userId) {
    params.set("user_id", userId);
  } else {
    params.set("session_id", sessionId);
  }
  if (typeof search === "string" && search.trim()) {
    params.set("search", search.trim());
  }
  const response = await apiGet<Product[] | { results: Product[] }>(
    `/recommendations/for-you/?${params.toString()}`,
  );
  return Array.isArray(response) ? response : response.results;
}

export async function fetchRelatedProducts(
  productId: string,
  limit = 4,
): Promise<Product[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  const response = await apiGet<Product[] | { results: Product[] }>(
    `/recommendations/related/${productId}/?${params.toString()}`,
    false,
  );
  return Array.isArray(response) ? response : response.results;
}

export async function recordRecommendationClick(productId: string) {
  return apiPost(`/recommendations/${productId}/click`, {});
}
