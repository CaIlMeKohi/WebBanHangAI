import type { Product } from "../data/products";
import type { AdminProduct } from "../types/admin";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://127.0.0.1:8000/api";

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
}

export async function fetchProducts(queryString = ""): Promise<Product[]> {
  const query = queryString ? `?${queryString}` : "";
  return apiGet<Product[]>(`/products/${query}`);
}

export async function fetchProductById(id: string): Promise<Product> {
  return apiGet<Product>(`/products/${id}/`);
}

// Admin CRUD operations
export async function fetchAdminProducts(): Promise<AdminProduct[]> {
  return apiGet<AdminProduct[]>(`/products/admin/products/`);
}

async function apiPostMultipart<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    body,
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function apiPutMultipart<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    body,
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function createAdminProduct(
  data: FormData,
): Promise<AdminProduct> {
  return apiPostMultipart<AdminProduct>(`/products/admin/products/`, data);
}

export async function updateAdminProduct(
  id: string,
  data: FormData,
): Promise<AdminProduct> {
  return apiPutMultipart<AdminProduct>(`/products/admin/products/${id}/`, data);
}

export async function deleteAdminProduct(id: string): Promise<void> {
  return apiDelete(`/products/admin/products/${id}/`);
}

export async function fetchForYouRecommendations(
  userId?: string,
  limitOrSession: number | string = 8,
  maybeLimitOrSession?: number | string,
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
  return apiGet<Product[]>(`/recommendations/for-you/?${params.toString()}`);
}

export async function fetchRelatedProducts(
  productId: string,
  limit = 4,
): Promise<Product[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  return apiGet<Product[]>(
    `/recommendations/related/${productId}/?${params.toString()}`,
  );
}
