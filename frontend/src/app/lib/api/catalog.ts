import type { CatalogQuery, CategoryNode, Product } from "../../data/products";
import { apiGet } from "../apiClient";

function buildCatalogQuery(query?: CatalogQuery | string): string {
  if (!query) {
    return "";
  }
  if (typeof query === "string") {
    return query ? `?${query}` : "";
  }

  const params = new URLSearchParams();
  if (query.category) params.set("category", query.category);
  if (query.gender) params.set("gender", query.gender);
  if (query.search) params.set("search", query.search);
  if (query.brand) params.set("brand", query.brand);
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
    false,
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
  const response = await apiGet<Product[] | ProductPage>(
    `/products/${query}`,
    false,
  );
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
  return apiGet<Product>(`/products/${id}/`, false);
}

export async function fetchCategories(): Promise<CategoryNode[]> {
  try {
    return await apiGet<CategoryNode[]>(`/products/categories/`, false);
  } catch {
    return [];
  }
}

export interface BrandOption {
  brand_id: number;
  id?: number;
  name: string;
  slug?: string;
}

export async function fetchBrands(): Promise<BrandOption[]> {
  try {
    return await apiGet<BrandOption[]>(`/products/brands/`, false);
  } catch {
    return [];
  }
}
