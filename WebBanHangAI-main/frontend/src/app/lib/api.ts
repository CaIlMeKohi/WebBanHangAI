import type { CatalogQuery, Product, CategoryNode } from "../data/products";
import type { AdminProduct } from "../types/admin";

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "/api";

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw await buildApiError(response);
  }
  return response.json() as Promise<T>;
}

async function buildApiError(response: Response): Promise<Error> {
  try {
    const data = await response.json();
    const detail = data.detail ?? Object.values(data).flat().join(" ");
    return new Error(detail || `API error ${response.status}`);
  } catch {
    return new Error(`API error ${response.status}`);
  }
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await buildApiError(response);
  }
  return response.json() as Promise<T>;
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw await buildApiError(response);
  }
  return response.json() as Promise<T>;
}

async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw await buildApiError(response);
  }
}

function authHeaders(): HeadersInit {
  try {
    const raw =
      localStorage.getItem("siteAuth") ?? localStorage.getItem("adminAuth");
    const token = raw ? (JSON.parse(raw) as { access?: string }).access : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

function jsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json", ...authHeaders() };
}

function buildCatalogQuery(query?: CatalogQuery | string): string {
  if (!query) {
    return "";
  }
  if (typeof query === "string") {
    return query ? `?${query}` : "";
  }

  const params = new URLSearchParams();
  if (query.category) params.set("category", query.category);
  if (query.search) params.set("search", query.search);
  if (query.isNew) params.set("new", "true");
  if (query.isSale) params.set("sale", "true");
  if (query.minPrice != null) params.set("minPrice", String(query.minPrice));
  if (query.maxPrice != null) params.set("maxPrice", String(query.maxPrice));
  if (query.sort) params.set("sort", query.sort);
  if (query.page && query.page > 1) params.set("page", String(query.page));
  if (query.includeUnisex === false) params.set("include_unisex", "false");
  query.subcategory?.forEach((item) => params.append("subcategory", item));

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export async function fetchProducts(
  catalogQuery?: CatalogQuery | string,
): Promise<Product[]> {
  const query = buildCatalogQuery(catalogQuery);
  const response = await apiGet<Product[] | { results: Product[] }>(
    `/products/${query}`,
  );
  return Array.isArray(response) ? response : response.results;
}

export interface ProductPage {
  count: number;
  next: string | null;
  previous: string | null;
  results: Product[];
}

export async function fetchProductPage(
  catalogQuery?: CatalogQuery | string,
): Promise<ProductPage> {
  const query = buildCatalogQuery(catalogQuery);
  const response = await apiGet<Product[] | ProductPage>(`/products/${query}`);
  if (Array.isArray(response)) {
    return {
      count: response.length,
      next: null,
      previous: null,
      results: response,
    };
  }
  return response;
}

export async function fetchProductById(id: string): Promise<Product> {
  return apiGet<Product>(`/products/${id}/`);
}

export async function fetchCategories(): Promise<CategoryNode[]> {
  try {
    return await apiGet<CategoryNode[]>(`/products/categories/`);
  } catch {
    // If API call fails, return empty array (fallback will be used in component)
    return [];
  }
}

export interface ApiUser {
  user_id: number;
  username: string;
  full_name: string;
  email: string;
  phone: string;
  role: "customer" | "staff" | "admin";
}

export interface RegisterUserPayload {
  username: string;
  password: string;
  full_name: string;
  phone?: string;
  gender?: string;
  birthday?: string;
  address_line?: string;
  ward?: string;
  district?: string;
  province?: string;
}

export interface ApiCartItem {
  cart_item_id: number;
  product_id: number;
  product: Product;
  variant_id: number | null;
  quantity: number;
  size: string;
  color: string;
}

export interface ApiWishlistItem {
  wishlist_item_id: number;
  product: Product;
}

export interface ApiAddress {
  address_id: number;
  full_name: string;
  phone: string;
  address_line: string;
  ward: string;
  district: string;
  province: string;
  is_default: boolean;
  created_at: string;
}

export interface ApiOrder {
  order_id: number;
  total_amount: number;
  shipping_fee: number;
  discount_amount: number;
  final_amount: number;
  status: string;
  payment_status: string;
  payment_method: string;
  created_at: string;
  items: Array<{
    order_item_id: number;
    product: Product;
    quantity: number;
    price: number;
  }>;
}

export async function loginUser(
  username: string,
  password: string,
): Promise<{ user: ApiUser; access?: string }> {
  const response = await apiPost<{ user: ApiUser; access?: string }>(
    `/products/auth/login/`,
    {
      username,
      password,
    },
  );
  return response;
}

export async function registerUser(
  data: RegisterUserPayload,
): Promise<{ user: ApiUser; access?: string }> {
  const response = await apiPost<{ user: ApiUser; access?: string }>(
    `/products/auth/register/`,
    {
      ...data,
    },
  );
  return response;
}

export async function fetchProfile(userId: number): Promise<ApiUser> {
  return apiGet<ApiUser>(`/products/profile/?user_id=${userId}`);
}

export async function updateProfile(
  userId: number,
  data: Partial<Pick<ApiUser, "full_name" | "phone">>,
): Promise<ApiUser> {
  return apiPut<ApiUser>(`/products/profile/`, { user_id: userId, ...data });
}

export async function fetchCart(userId: number): Promise<ApiCartItem[]> {
  return apiGet<ApiCartItem[]>(`/products/cart/?user_id=${userId}`);
}

export async function addCartItem(data: {
  user_id: number;
  product_id: number | string;
  quantity?: number;
  size?: string;
  color?: string;
}): Promise<ApiCartItem> {
  return apiPost<ApiCartItem>(`/products/cart/`, data);
}

export async function updateCartItem(
  userId: number,
  itemId: number,
  quantity: number,
): Promise<ApiCartItem> {
  return apiPut<ApiCartItem>(`/products/cart/${itemId}/`, {
    user_id: userId,
    quantity,
  });
}

export async function deleteCartItem(
  userId: number,
  itemId: number,
): Promise<void> {
  return apiDelete(`/products/cart/${itemId}/?user_id=${userId}`);
}

export async function fetchWishlist(
  userId: number,
): Promise<ApiWishlistItem[]> {
  return apiGet<ApiWishlistItem[]>(`/products/wishlist/?user_id=${userId}`);
}

export async function fetchAddresses(userId: number): Promise<ApiAddress[]> {
  return apiGet<ApiAddress[]>(`/products/addresses/?user_id=${userId}`);
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

export async function fetchOrders(userId: number): Promise<ApiOrder[]> {
  return apiGet<ApiOrder[]>(`/products/orders/?user_id=${userId}`);
}

export async function createOrder(
  userId: number,
  paymentMethod = "cod",
  cartItemIds?: number[],
): Promise<ApiOrder> {
  return apiPost<ApiOrder>(`/products/orders/`, {
    user_id: userId,
    payment_method: paymentMethod,
    cart_item_ids: cartItemIds,
  });
}

export async function confirmMockPayment(
  orderId: number,
  provider = "bank_transfer",
) {
  return apiPost(`/payments/${provider}/callback`, {
    order_id: orderId,
    success: true,
    transaction_id: `QR-${orderId}-${Date.now()}`,
  });
}

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

// Admin CRUD operations
export async function fetchAdminProducts(): Promise<AdminProduct[]> {
  return apiGet<AdminProduct[]>(`/products/admin/products/`);
}

async function apiPostMultipart<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body,
  });
  if (!response.ok) {
    throw await buildApiError(response);
  }
  return response.json() as Promise<T>;
}

async function apiPutMultipart<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PUT",
    headers: authHeaders(),
    body,
  });
  if (!response.ok) {
    throw await buildApiError(response);
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
  );
  return Array.isArray(response) ? response : response.results;
}

export async function recordRecommendationClick(productId: string) {
  return apiPost(`/recommendations/${productId}/click`, {});
}
