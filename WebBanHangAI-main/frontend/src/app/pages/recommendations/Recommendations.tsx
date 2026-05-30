import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "../../components/catalog/ProductCard";
import type { Product } from "../../data/products";
import {
  Sparkles,
  TrendingUp,
  Eye,
  ShoppingBag,
  Heart,
  Zap,
  RefreshCw,
} from "lucide-react";
import { fetchForYouRecommendations } from "../../lib/api";
import { useCatalog } from "../../hooks/useCatalog";
import { useAdminAuth } from "../../context/AdminAuthContext";

export function Recommendations() {
  const { products } = useCatalog();
  const { userId } = useAdminAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [forYouProducts, setForYouProducts] = useState<Product[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function loadForYou() {
      try {
        const recommended = await fetchForYouRecommendations(
          userId ? String(userId) : undefined,
          8,
        );
        if (isMounted) setForYouProducts(recommended);
      } catch {
        if (isMounted) setForYouProducts([]);
      }
    }

    loadForYou();

    return () => {
      isMounted = false;
    };
  }, [refreshKey, userId]);

  const trendingProducts = useMemo(
    () => products.filter((p) => p.isTrending).slice(0, 4),
    [products],
  );
  const recentlyViewedProducts = useMemo(() => products.slice(0, 4), [products]);
  const similarToLikedProducts = useMemo(
    () => products.filter((p) => p.isBestSeller).slice(0, 4),
    [products],
  );
  const completeTheLookProducts = useMemo(() => products.slice(4, 8), [products]);
  const flashDealsProducts = useMemo(
    () => products.filter((p) => p.originalPrice).slice(0, 4),
    [products],
  );

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
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
              Sản phẩm dành cho bạn
            </h1>
            <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-8">
              Khám phá những sản phẩm được chọn lọc dựa trên hành vi mua sắm,
              sản phẩm đã xem, yêu thích và giỏ hàng của bạn.
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

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-light tracking-wide">
                  Đặc biệt dành cho bạn
                </h2>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-1 mt-1">
                  Được chọn lọc dựa trên sở thích của bạn
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full font-medium">
                Gợi ý AI
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

      <section className="py-16 bg-neutral-50 dark:bg-neutral-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
              <TrendingUp className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-3xl font-light tracking-wide">Đang thịnh hành</h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Sản phẩm được nhiều người quan tâm nhất
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

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Eye className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-3xl font-light tracking-wide">
                Dựa trên lịch sử xem
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

      <section className="py-16 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-pink-100 dark:bg-pink-900 rounded-lg">
              <Heart className="w-6 h-6 text-pink-600 dark:text-pink-400" />
            </div>
            <div>
              <h2 className="text-3xl font-light tracking-wide">
                Tương tự sản phẩm yêu thích
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

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-3xl font-light tracking-wide">
                Hoàn thiện phong cách
              </h2>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Kết hợp phù hợp cho trang phục của bạn
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

      <section className="py-16 bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 dark:from-yellow-950/20 dark:via-orange-950/20 dark:to-red-950/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg animate-pulse">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-light tracking-wide">
                Ưu đãi đặc biệt cho bạn
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

      <section className="py-16 bg-neutral-900 dark:bg-neutral-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-light tracking-wide mb-4">
              Vì sao chọn gợi ý AI của chúng tôi?
            </h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              Hệ thống phân tích lượt xem, yêu thích, giỏ hàng và lịch sử mua để
              đưa ra gợi ý sát nhu cầu hơn.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-full flex items-center justify-center">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-medium mb-2">Cá nhân hóa</h3>
              <p className="text-neutral-400">
                Mỗi gợi ý được tạo dựa trên tương tác thực tế của người dùng.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-purple-600 rounded-full flex items-center justify-center">
                <TrendingUp className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-medium mb-2">Cập nhật liên tục</h3>
              <p className="text-neutral-400">
                Điểm gợi ý thay đổi theo lượt xem, yêu thích, giỏ hàng và đơn mua.
              </p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-pink-600 rounded-full flex items-center justify-center">
                <Heart className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-medium mb-2">Bám sát nghiệp vụ</h3>
              <p className="text-neutral-400">
                Ưu tiên sản phẩm còn hàng, bán chạy, đúng danh mục và thương hiệu phù hợp.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
