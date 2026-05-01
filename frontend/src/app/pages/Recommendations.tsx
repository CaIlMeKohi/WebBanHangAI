import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "../components/ProductCard";
import { getAIRecommendations, type Product } from "../data/products";
import {
  Sparkles,
  TrendingUp,
  Eye,
  ShoppingBag,
  Heart,
  Zap,
  RefreshCw,
} from "lucide-react";
import { fetchForYouRecommendations } from "../lib/api";
import { useCatalog } from "../hooks/useCatalog";

export function Recommendations() {
  const { products } = useCatalog();
  const [refreshKey, setRefreshKey] = useState(0);
  const [forYouProducts, setForYouProducts] = useState<Product[]>(() =>
    getAIRecommendations("guest-user").slice(0, 8),
  );

  useEffect(() => {
    let isMounted = true;

    async function loadForYou() {
      try {
        const recommended = await fetchForYouRecommendations("user123", 8);
        if (isMounted && recommended.length > 0) {
          setForYouProducts(recommended);
        }
      } catch {
        if (isMounted) {
          setForYouProducts(getAIRecommendations("user123", []).slice(0, 8));
        }
      }
    }

    loadForYou();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const trendingProducts = useMemo(
    () => products.filter((p) => p.isTrending).slice(0, 4),
    [products],
  );
  const recentlyViewedProducts = useMemo(
    () => products.slice(0, 4),
    [products],
  );
  const similarToLikedProducts = useMemo(
    () => products.filter((p) => p.isBestSeller).slice(0, 4),
    [products],
  );
  const completeTheLookProducts = useMemo(
    () => products.slice(4, 8),
    [products],
  );
  const flashDealsProducts = useMemo(
    () => products.filter((p) => p.originalPrice).slice(0, 4),
    [products],
  );

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950 dark:via-purple-950 dark:to-pink-950 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-neutral-800 rounded-full mb-6 shadow-sm">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span className="text-sm font-medium text-neutral-900 dark:text-white">
                Được hỗ trợ bởi AI
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-light tracking-wide mb-4">
              Sản Phẩm Dành Cho Bạn
            </h1>
            <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-8">
              Khám phá những sản phẩm được chọn lọc đặc biệt dựa trên sở thích
              và phong cách của bạn. AI của chúng tôi phân tích hành vi mua sắm
              để mang đến những gợi ý hoàn hảo nhất.
            </p>
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium tracking-wide hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-all hover:scale-105"
            >
              <RefreshCw className="w-4 h-4" />
              Làm mới gợi ý
            </button>
          </div>
        </div>
      </section>

      {/* Main Recommendations */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-light tracking-wide">
                  Đặc Biệt Dành Cho Bạn
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-1 mt-1">
                  Được chọn lọc dựa trên sở thích của bạn
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full font-medium">
                95% phù hợp
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {forYouProducts.map((product) => (
              <div key={product.id} className="relative">
                <div className="absolute -top-2 -right-2 z-10 p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-lg">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Now */}
      <section className="py-16 bg-neutral-50 dark:bg-neutral-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
              <TrendingUp className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-3xl font-light tracking-wide">
                Đang Thịnh Hành
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Sản phẩm được nhiều người quan tâm nhất tuần này
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trendingProducts.map((product, index) => (
              <div key={product.id} className="relative">
                <div className="absolute top-3 left-3 z-10 px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-full shadow-lg">
                  #{index + 1}
                </div>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Based on Recently Viewed */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Eye className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-3xl font-light tracking-wide">
                Dựa Trên Lịch Sử Xem
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Sản phẩm tương tự với những gì bạn đã xem
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {recentlyViewedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Similar to What You Liked */}
      <section className="py-16 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-pink-100 dark:bg-pink-900 rounded-lg">
              <Heart className="w-6 h-6 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <h2 className="text-3xl font-light tracking-wide">
                Tương Tự Sản Phẩm Yêu Thích
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Dựa trên những sản phẩm bạn đã thích
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {similarToLikedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Complete The Look */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-3xl font-light tracking-wide">
                Hoàn Thiện Phong Cách
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Kết hợp hoàn hảo cho trang phục của bạn
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {completeTheLookProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* Flash Deals - AI Selected */}
      <section className="py-16 bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 dark:from-yellow-950/20 dark:via-orange-950/20 dark:to-red-950/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg animate-pulse">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-light tracking-wide">
                Ưu Đãi Đặc Biệt Cho Bạn
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Giảm giá dành riêng cho những sản phẩm bạn quan tâm
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {flashDealsProducts.map((product) => (
              <div key={product.id} className="relative">
                <div className="absolute -top-3 -right-3 z-10">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full blur-md"></div>
                    <div className="relative px-4 py-2 bg-gradient-to-br from-yellow-400 to-orange-500 text-white text-xs font-bold rounded-full shadow-lg">
                      HOT DEAL
                    </div>
                  </div>
                </div>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why AI Recommendations */}
      <section className="py-16 bg-neutral-900 dark:bg-neutral-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-light tracking-wide mb-4">
              Tại Sao Chọn Gợi Ý AI Của Chúng Tôi?
            </h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              Công nghệ AI tiên tiến giúp chúng tôi hiểu rõ phong cách và sở
              thích của bạn
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-full flex items-center justify-center">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-medium mb-2">Cá Nhân Hóa 100%</h3>
              <p className="text-neutral-400">
                Mỗi gợi ý được tạo riêng dựa trên hành vi mua sắm của bạn
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-purple-600 rounded-full flex items-center justify-center">
                <TrendingUp className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-medium mb-2">Cập Nhật Realtime</h3>
              <p className="text-neutral-400">
                Gợi ý được cập nhật liên tục dựa trên xu hướng mới nhất
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-pink-600 rounded-full flex items-center justify-center">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-medium mb-2">Độ Chính Xác Cao</h3>
              <p className="text-neutral-400">
                95% khách hàng hài lòng với các sản phẩm được đề xuất
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-12 text-center text-white">
            <Sparkles className="w-12 h-12 mx-auto mb-4" />
            <h2 className="text-3xl font-light tracking-wide mb-4">
              Nhận Gợi Ý Tốt Hơn
            </h2>
            <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
              Đăng nhập để nhận những gợi ý chính xác hơn dựa trên lịch sử mua
              sắm và sở thích của bạn
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="px-8 py-4 bg-white text-neutral-900 font-medium tracking-wide hover:bg-neutral-100 transition-colors rounded-lg">
                ĐĂNG NHẬP
              </button>
              <button className="px-8 py-4 border-2 border-white text-white font-medium tracking-wide hover:bg-white hover:text-neutral-900 transition-all rounded-lg">
                TẠO TÀI KHOẢN
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
