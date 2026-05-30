import { useEffect, useMemo, useState } from "react";

import { fetchProducts } from "../lib/api";
import type { CatalogQuery, Product } from "../data/products";

export function useCatalog(query?: CatalogQuery) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      if (isMounted) {
        setIsLoading(true);
        setError(null);
      }

      try {
        const apiProducts = await fetchProducts(query);
        if (isMounted) {
          setProducts(apiProducts);
        }
      } catch (caughtError) {
        if (isMounted) {
          setProducts([]);
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : "Không tải được dữ liệu sản phẩm",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadProducts();

    return () => {
      isMounted = false;
    };
  }, [query]);

  return useMemo(
    () => ({ products, isLoading, error }),
    [products, isLoading, error],
  );
}
