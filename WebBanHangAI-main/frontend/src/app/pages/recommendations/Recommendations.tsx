import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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
          12,
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
    <main className="min-h-screen bg-white text-neutral-950">
      <section className="border-b bg-neutral-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-5 px-4 py-10 sm:px-6 lg:px-8">
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-neutral-600">
              <Sparkles className="h-4 w-4" />
              AI Picks
            </div>
            <h1 className="text-3xl font-light">Dành cho bạn</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} isRecommendation />
            ))}
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

function Signal({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 border bg-white px-3 py-3 text-sm text-neutral-600">
      {icon}
      {text}
    </div>
  );
}
