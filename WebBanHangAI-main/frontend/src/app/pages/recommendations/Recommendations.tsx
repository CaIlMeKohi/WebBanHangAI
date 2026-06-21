import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Heart, RefreshCw, Search, ShoppingBag, Sparkles } from "lucide-react";

import { ProductCard } from "../../components/catalog/ProductCard";
import { useAdminAuth } from "../../context/AdminAuthContext";
import type { Product } from "../../data/products";
import { fetchForYouRecommendations } from "../../lib/api";
import { readRecommendationSearch } from "../../lib/recommendationStorage";

export function Recommendations() {
  const { userId } = useAdminAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const observedProductTypes = useMemo(
    () => getObservedProductTypes(products),
    [products],
  );

  useEffect(() => {
    let isMounted = true;

    async function loadRecommendations() {
      setIsLoading(true);
      try {
        const params = new URLSearchParams(window.location.search);
        const search =
          params.get("search") ??
          readRecommendationSearch(userId) ??
          undefined;
        const nextProducts = await fetchForYouRecommendations(
          userId ? String(userId) : undefined,
          32,
          undefined,
          search,
        );
        if (isMounted) setProducts(nextProducts);
      } catch {
        if (isMounted) setProducts([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadRecommendations();
    return () => {
      isMounted = false;
    };
  }, [refreshKey, userId]);

  return (
    <main className="min-h-screen bg-white text-neutral-950 dark:bg-neutral-950 dark:text-white">
      <section className="border-b bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-5 px-4 py-10 sm:px-6 lg:px-8">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-300">
              <Sparkles className="h-4 w-4" />
              AI Picks
            </div>
            <h1 className="text-3xl font-light">Dành cho bạn</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600 dark:text-neutral-300">
              Gợi ý được cập nhật từ tìm kiếm, lượt xem, yêu thích, giỏ hàng và lịch sử mua của bạn.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            className="inline-flex items-center gap-2 border border-neutral-950 bg-neutral-950 px-4 py-2 text-sm text-white transition-colors hover:bg-neutral-800"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <Signal icon={<Search className="h-4 w-4" />} text="Search và sản phẩm đã xem" />
          <Signal icon={<Heart className="h-4 w-4" />} text="Wishlist và category yêu thích" />
          <Signal icon={<ShoppingBag className="h-4 w-4" />} text="Giỏ hàng và lịch sử mua" />
        </div>

        {isLoading ? (
          <div className="border py-16 text-center text-sm text-neutral-500">
            Đang cập nhật gợi ý...
          </div>
        ) : products.length ? (
          <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
            <aside className="border bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
              <p className="text-sm font-medium leading-6 text-neutral-900 dark:text-white">
                Các sản phẩm bạn đã xem gần đây liên quan đến:
              </p>
              <div className="mt-4 space-y-2">
                {observedProductTypes.map((type) => (
                  <Link
                    key={type.slug}
                    to={`/shop?category=${encodeURIComponent(type.slug)}`}
                    className="block rounded-full border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 transition-colors hover:border-neutral-900 hover:text-neutral-950 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-200 dark:hover:border-white dark:hover:text-white"
                  >
                    {type.label}
                  </Link>
                ))}
              </div>
            </aside>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} isRecommendation />
              ))}
            </div>
          </div>
        ) : (
          <div className="border py-16 text-center">
            <Sparkles className="mx-auto mb-3 h-6 w-6 text-neutral-400" />
            <p className="text-sm text-neutral-600">
              Chưa có sản phẩm phù hợp. Hãy xem hoặc tìm kiếm thêm sản phẩm để hệ thống học sở thích của bạn.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function getObservedProductTypes(products: Product[]) {
  const counts = new Map<string, { label: string; slug: string; count: number }>();

  for (const product of products) {
    const label =
      product.subcategoryName ||
      product.categoryName ||
      product.category ||
      "";
    const slug = product.subcategory || product.category || "";
    const normalized = label.trim();
    if (!normalized || !slug) continue;
    const current = counts.get(slug);
    counts.set(slug, {
      label: current?.label ?? normalized,
      slug,
      count: (current?.count ?? 0) + 1,
    });
  }

  return [...counts.values()]
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label, "vi"))
    .slice(0, 4)
}

function Signal({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 border bg-white px-3 py-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
      {icon}
      {text}
    </div>
  );
}
