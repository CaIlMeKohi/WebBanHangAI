import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Sparkles } from "lucide-react";

import { ProductCard } from "../../components/catalog/ProductCard";
import { heroImage, type Product } from "../../data/products";
import { useCatalog } from "../../hooks/useCatalog";
import { fetchForYouRecommendations } from "../../lib/api";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { readRecommendationSearch } from "../../lib/recommendationStorage";

const collectionTiles = [
  {
    title: "Nữ",
    href: "/shop?category=women",
    image:
      "https://images.unsplash.com/photo-1769107805528-964f4de0e342?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    title: "Nam",
    href: "/shop?category=men",
    image:
      "https://images.unsplash.com/photo-1722926628555-252c1c0258bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
  {
    title: "Hàng mới",
    href: "/shop?new=true",
    image:
      "https://images.unsplash.com/photo-1618677603544-51162346e165?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
  },
];

export function Home() {
  const { products } = useCatalog();
  const { userId } = useAdminAuth();
  const [aiRecommendations, setAiRecommendations] = useState<Product[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadRecommendations() {
      try {
        const recommendations = await fetchForYouRecommendations(
          userId ? String(userId) : undefined,
          4,
          "guest-home",
          readRecommendationSearch(userId),
        );
        if (isMounted) setAiRecommendations(recommendations);
      } catch {
        if (isMounted) setAiRecommendations([]);
      }
    }

    loadRecommendations();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  const newArrivals = useMemo(
    () => products.filter((item) => item.isNew).slice(0, 4),
    [products],
  );
  const bestSellers = useMemo(
    () => products.filter((item) => item.isBestSeller).slice(0, 4),
    [products],
  );
  const fallbackRow = products.slice(0, 4);

  return (
    <div className="bg-white text-neutral-950">
      <section className="relative min-h-[calc(100vh-64px)] overflow-hidden">
        <img
          src={heroImage}
          alt="Fashion editorial"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/35" />
        <div className="relative flex min-h-[calc(100vh-64px)] items-end">
          <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
            <div className="max-w-2xl text-white">
              <div className="mb-4 text-xs font-medium uppercase tracking-[0.25em]">
                Cửa hàng thời trang tuyển chọn
              </div>
              <h1 className="mb-5 text-5xl font-light leading-none tracking-wide md:text-7xl">
                Phong cách mỗi ngày.
              </h1>
              <p className="mb-8 max-w-xl text-base leading-7 text-white/85">
                Chọn nhanh các sản phẩm đang bán, lọc theo bộ sưu tập, xem chi
                tiết biến thể và thêm vào giỏ chỉ trong vài thao tác.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2 bg-white px-6 py-3 text-sm font-medium uppercase tracking-wide text-neutral-950 transition-colors hover:bg-neutral-950 hover:text-white"
                >
                  Xem tất cả
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/danh-cho-ban"
                  className="inline-flex items-center gap-2 border border-white/70 px-6 py-3 text-sm font-medium uppercase tracking-wide text-white transition-colors hover:bg-white hover:text-neutral-950"
                >
                  Gợi ý AI
                  <Sparkles className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.22em] text-neutral-500">
              Mua theo phong cách
            </div>
            <h2 className="text-3xl font-light tracking-wide">Bộ sưu tập</h2>
          </div>
          <Link to="/shop" className="text-sm font-medium underline">
            Xem tất cả
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {collectionTiles.map((tile) => (
            <Link
              key={tile.title}
              to={tile.href}
              className="group relative aspect-[4/5] overflow-hidden bg-neutral-100"
            >
              <img
                src={tile.image}
                alt={tile.title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute bottom-5 left-5 text-white">
                <h3 className="text-2xl font-light">{tile.title}</h3>
                <div className="mt-2 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
                  Khám phá <ArrowRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ProductSection
        title="Hàng mới"
        eyebrow="Vừa cập nhật"
        href="/shop?new=true"
        products={newArrivals.length ? newArrivals : fallbackRow}
      />

      <ProductSection
        title="Bán chạy"
        eyebrow="Được yêu thích"
        href="/shop"
        products={bestSellers.length ? bestSellers : fallbackRow}
        muted
      />

      <ProductSection
        title="Dành cho bạn"
        eyebrow="Gợi ý AI"
        href="/danh-cho-ban"
        products={aiRecommendations}
        emptyText="Chưa có gợi ý AI từ DB."
      />
    </div>
  );
}

function ProductSection({
  title,
  eyebrow,
  href,
  products,
  muted = false,
  emptyText = "Chưa có sản phẩm.",
}: {
  title: string;
  eyebrow: string;
  href: string;
  products: Product[];
  muted?: boolean;
  emptyText?: string;
}) {
  return (
    <section className={muted ? "bg-neutral-50 py-14" : "py-14"}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <div className="mb-2 text-xs uppercase tracking-[0.22em] text-neutral-500">
              {eyebrow}
            </div>
            <h2 className="text-3xl font-light tracking-wide">{title}</h2>
          </div>
          <Link to={href} className="text-sm font-medium underline">
            Xem tất cả
          </Link>
        </div>
        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} isRecommendation={eyebrow === "Gợi ý AI"} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">{emptyText}</p>
        )}
      </div>
    </section>
  );
}
