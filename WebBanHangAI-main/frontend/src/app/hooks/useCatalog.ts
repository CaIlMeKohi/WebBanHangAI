import { useEffect, useMemo, useState } from "react";

import { fetchProductPage } from "../lib/api";
import type { CatalogQuery, Product } from "../data/products";

export function useCatalog(query?: CatalogQuery) {
  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
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
        const productPage = await fetchProductPage(query);
        if (isMounted) {
          setProducts(productPage.results);
          setTotalCount(productPage.count);
        }
      } catch (caughtError) {
        if (isMounted) {
          setProducts([]);
          setTotalCount(0);
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
    () => ({ products, totalCount, isLoading, error }),
    [products, totalCount, isLoading, error],
  );
}
