import { useEffect, useMemo, useState } from "react";

import { fetchProducts } from "../lib/api";
import {
  filterProducts,
  products as fallbackProducts,
  type CatalogQuery,
  type Product,
} from "../data/products";

export function useCatalog(query?: CatalogQuery) {
  const [products, setProducts] = useState<Product[]>(() =>
    filterProducts(fallbackProducts, query),
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      if (isMounted) {
        setIsLoading(true);
        setProducts(filterProducts(fallbackProducts, query));
      }

      try {
        const apiProducts = await fetchProducts(query);
        if (isMounted) {
          setProducts(apiProducts);
        }
      } catch {
        if (isMounted) {
          setProducts(filterProducts(fallbackProducts, query));
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

  return useMemo(() => ({ products, isLoading }), [products, isLoading]);
}
