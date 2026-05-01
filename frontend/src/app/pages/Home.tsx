import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ProductCard } from "../components/ProductCard";
import {
  heroImage,
  getAIRecommendations,
  type Product,
} from "../data/products";
import { Sparkles, ArrowRight } from "lucide-react";
import { useCatalog } from "../hooks/useCatalog";
import { fetchForYouRecommendations } from "../lib/api";

export function Home() {
  const { products } = useCatalog();
  const [aiRecommendations, setAiRecommendations] = useState<Product[]>(() =>
    getAIRecommendations("guest-user").slice(0, 4),
  );

  useEffect(() => {
    let isMounted = true;

    async function loadRecommendations() {
      try {
        const recommendations = await fetchForYouRecommendations(
          "guest-user",
          4,
        );
        if (isMounted && recommendations.length > 0) {
          setAiRecommendations(recommendations);
        }
      } catch {
        if (isMounted) {
          setAiRecommendations(getAIRecommendations("guest-user").slice(0, 4));
        }
      }
    }

    loadRecommendations();

    return () => {
      isMounted = false;
    };
  }, []);

  const trendingProducts = useMemo(
    () => products.filter((p) => p.isTrending).slice(0, 4),
    [products],
  );
  const bestSellers = useMemo(
    () => products.filter((p) => p.isBestSeller).slice(0, 4),
    [products],
  );

  return (
    <div>
      <section className="relative h-[70vh] md:h-[80vh] overflow-hidden">
        <img
          src={heroImage}
          alt="Banner chính"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="max-w-xl">
              <h1 className="text-white text-4xl md:text-6xl font-light tracking-wider mb-4">
                Bộ Sưu Tập Xuân 2026
              </h1>
              <p className="text-white/90 text-lg mb-8">
                Khám phá những thiết kế vượt thời gian định nghĩa sự thanh lịch
                hiện đại
              </p>
              <Link
                to="/shop?new=true"
                className="inline-flex items-center gap-2 px-8 py-3 bg-white text-neutral-900 font-medium tracking-wide hover:bg-neutral-900 hover:text-white transition-colors"
              >
                MUA NGAY
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-gradient-to-b from-blue-50/30 to-white dark:from-blue-950/10 dark:to-neutral-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-light tracking-wide">
                  Gợi Ý Dành Cho Bạn
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Được hỗ trợ bởi AI
                </p>
              </div>
            </div>
            <Link
              to="/shop"
              className="text-sm font-medium hover:underline flex items-center gap-1"
            >
              Xem tất cả
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {aiRecommendations.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-light tracking-wide">
              Xu Hướng Hiện Nay
            </h2>
            <Link
              to="/shop"
              className="text-sm font-medium hover:underline flex items-center gap-1"
            >
              Xem tất cả
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trendingProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-neutral-50 dark:bg-neutral-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-light tracking-wide">Bán Chạy Nhất</h2>
            <Link
              to="/shop"
              className="text-sm font-medium hover:underline flex items-center gap-1"
            >
              Xem tất cả
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {bestSellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              to="/shop?category=women"
              className="group relative h-96 overflow-hidden"
            >
              <img
                src="https://images.unsplash.com/photo-1769107805528-964f4de0e342?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aGl0ZSUyMGRyZXNzJTIwbWluaW1hbGlzdCUyMGZhc2hpb258ZW58MXx8fHwxNzc0Njg2MTMyfDA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Bộ Sưu Tập Nữ"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="text-center">
                  <h3 className="text-white text-3xl font-light tracking-wider mb-2">
                    THỜI TRANG NỮ
                  </h3>
                  <p className="text-white/90 text-sm tracking-wide">
                    Khám phá bộ sưu tập
                  </p>
                </div>
              </div>
            </Link>
            <Link
              to="/shop?category=men"
              className="group relative h-96 overflow-hidden"
            >
              <img
                src="https://images.unsplash.com/photo-1722926628555-252c1c0258bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmF5JTIwY2FzdWFsJTIwc2hpcnQlMjBjbG90aGluZ3xlbnwxfHx8fDE3NzQ2ODYxMzJ8MA&ixlib=rb-4.1.0&q=80&w=1080"
                alt="Bộ Sưu Tập Nam"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="text-center">
                  <h3 className="text-white text-3xl font-light tracking-wider mb-2">
                    THỜI TRANG NAM
                  </h3>
                  <p className="text-white/90 text-sm tracking-wide">
                    Khám phá bộ sưu tập
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
