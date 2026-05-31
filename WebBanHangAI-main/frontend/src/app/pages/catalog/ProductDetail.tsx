import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";

import { ProductCard } from "../../components/catalog/ProductCard";
import type { Product } from "../../data/products";
import {
  addCartItem,
  addWishlistItem,
  fetchProductById,
  fetchRelatedProducts,
  fetchWishlist,
} from "../../lib/api";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { CART_UPDATED_EVENT, addStoredCartItem } from "../../lib/cartStorage";
import {
  formatCurrency,
  formatShortDate,
  getColorSwatchStyle,
} from "../../lib/productPresentation";
import { dispatchCartAddedNotice } from "../../lib/cartNotice";
import {
  addStoredWishlistId,
  readStoredWishlistIds,
} from "../../lib/wishlistStorage";

export function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const { userId } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState<Product | undefined>();
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isLiked, setIsLiked] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const redirectToLogin = () => {
    const next = `${location.pathname}${location.search}`;
    navigate(`/login?next=${encodeURIComponent(next)}`);
  };

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [id]);

  useEffect(() => {
    if (!product) return;
    setCurrentImageIndex(0);
    setSelectedColor(product.colors[0] ?? "");
    setSelectedSize(product.sizes[0] ?? "");
    setQuantity(1);
  }, [product]);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadProductDetail() {
      setIsLoading(true);
      try {
        const apiProduct = await fetchProductById(id as string);
        const apiRelated = await fetchRelatedProducts(id as string, 4).catch(
          () => [],
        );

        if (isMounted) {
          setProduct(apiProduct);
          setRelatedProducts(apiRelated);
        }
      } catch {
        if (isMounted) {
          setProduct(undefined);
          setRelatedProducts([]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProductDetail();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (!userId || !id) {
      setIsLiked(false);
      return;
    }

    let isMounted = true;

    async function loadWishlistState() {
      try {
        const items = await fetchWishlist(userId as number);
        if (isMounted) {
          setIsLiked(
            items.some((item) => String(item.product.id) === String(id)),
          );
        }
      } catch {
        if (isMounted) setIsLiked(readStoredWishlistIds().includes(String(id)));
      }
    }

    loadWishlistState();
    return () => {
      isMounted = false;
    };
  }, [id, userId]);

  if (!product && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-neutral-600 dark:text-neutral-400">
          Đang tải chi tiết sản phẩm...
        </p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="mb-4 text-2xl font-light">Không tìm thấy sản phẩm</h2>
          <Link to="/shop" className="text-sm underline">
            Quay lại cửa hàng
          </Link>
        </div>
      </div>
    );
  }

  const productImages =
    product.images && product.images.length > 0
      ? product.images
      : [product.image];
  const currentImage = productImages[currentImageIndex] ?? product.image;
  const lastUpdated = formatShortDate(product.createdAt);
  const discountPercent =
    product.originalPrice && product.originalPrice > product.price
      ? Math.round(
          ((product.originalPrice - product.price) / product.originalPrice) *
            100,
        )
      : null;

  const handleAddToCart = async () => {
    const size = selectedSize || product.sizes[0] || "STD";
    const color = selectedColor || product.colors[0] || "Mặc định";

    if (!userId) {
      redirectToLogin();
      return;
    }

    try {
      await addCartItem({
        user_id: userId,
        product_id: product.id,
        quantity,
        size,
        color,
      });
    } catch {
      addStoredCartItem({ id: String(product.id), quantity, size, color });
    }

    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
    dispatchCartAddedNotice();
  };

  const handleBuyNow = async () => {
    await handleAddToCart();
    if (userId) {
      navigate("/cart");
    }
  };

  const handleWishlist = async () => {
    if (!userId) {
      redirectToLogin();
      return;
    }
    if (isLiked) return;
    setIsLiked(true);
    addStoredWishlistId(String(product.id));
    await addWishlistItem(userId, product.id).catch(() => undefined);
    window.dispatchEvent(new Event("wishlist:updated"));
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
          <Link to="/" className="hover:text-neutral-900 dark:hover:text-white">
            Trang chủ
          </Link>
          <span>/</span>
          <Link
            to={`/shop${product.category ? `?category=${product.category}` : ""}`}
            className="hover:text-neutral-900 dark:hover:text-white"
          >
            {product.categoryName ?? "Cửa hàng"}
          </Link>
          <span>/</span>
          <span className="text-neutral-900 dark:text-white">
            {product.name}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div>
            <div className="group relative mb-4 aspect-[3/4] overflow-hidden bg-neutral-100 dark:bg-neutral-800">
              <img
                src={currentImage}
                alt={product.name}
                className="h-full w-full object-cover"
              />
              {productImages.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setCurrentImageIndex(
                        (currentValue) =>
                          (currentValue - 1 + productImages.length) %
                          productImages.length,
                      )
                    }
                    className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white p-2 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentImageIndex(
                        (currentValue) =>
                          (currentValue + 1) % productImages.length,
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white p-2 opacity-0 transition-opacity group-hover:opacity-100"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>

            <div className="grid grid-cols-4 gap-4">
              {productImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`aspect-square overflow-hidden border-2 bg-neutral-100 dark:bg-neutral-800 ${
                    currentImageIndex === index
                      ? "border-neutral-900 dark:border-white"
                      : "border-transparent"
                  }`}
                >
                  <img
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {product.isNew && (
                    <span className="bg-neutral-900 px-3 py-1 text-xs font-medium tracking-wide text-white dark:bg-white dark:text-neutral-900">
                      MỚI
                    </span>
                  )}
                  {product.isBestSeller && (
                    <span className="border border-neutral-300 px-3 py-1 text-xs font-medium tracking-wide dark:border-neutral-700">
                      BÁN CHẠY
                    </span>
                  )}
                  {product.isTrending && (
                    <span className="border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium tracking-wide text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                      XU HƯỚNG
                    </span>
                  )}
                </div>
                <h1 className="text-3xl font-light tracking-wide">
                  {product.name}
                </h1>
                <div className="flex items-center gap-2">
                  <div className="flex">
                    {[...Array(5)].map((_, index) => (
                      <Star
                        key={index}
                        className={`h-4 w-4 ${
                          index < Math.floor(product.rating)
                            ? "fill-neutral-900 text-neutral-900 dark:fill-white dark:text-white"
                            : "text-neutral-300 dark:text-neutral-600"
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {product.rating} ({product.reviews} đánh giá)
                  </span>
                </div>
              </div>

              <button
                onClick={() => void handleWishlist()}
                className="rounded-full p-2 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Heart
                  className={`h-6 w-6 ${
                    isLiked
                      ? "fill-red-500 text-red-500"
                      : "text-neutral-900 dark:text-white"
                  }`}
                />
              </button>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span className="text-3xl font-light">
                {formatCurrency(product.price)}
              </span>
              {product.originalPrice && (
                <span className="text-xl text-neutral-400 line-through">
                  {formatCurrency(product.originalPrice)}
                </span>
              )}
              {discountPercent && (
                <span className="bg-red-600 px-2 py-1 text-xs font-medium text-white">
                  GIẢM {discountPercent}%
                </span>
              )}
            </div>

            <p className="mb-6 leading-relaxed text-neutral-700 dark:text-neutral-300">
              {product.description}
            </p>

            <div className="mb-6 grid grid-cols-1 gap-3 rounded-2xl border border-neutral-200 p-4 text-sm dark:border-neutral-800 md:grid-cols-2">
              <div>
                <span className="block text-neutral-500 dark:text-neutral-400">
                  Thương hiệu
                </span>
                <span>{product.brandName ?? "Đang cập nhật"}</span>
              </div>
              <div>
                <span className="block text-neutral-500 dark:text-neutral-400">
                  Danh mục
                </span>
                <span>{product.subcategoryName ?? product.categoryName}</span>
              </div>
              <div>
                <span className="block text-neutral-500 dark:text-neutral-400">
                  Tồn kho
                </span>
                <span>
                  {typeof product.stockQuantity === "number"
                    ? `${product.stockQuantity} sản phẩm`
                    : "Đang cập nhật"}
                </span>
              </div>
              <div>
                <span className="block text-neutral-500 dark:text-neutral-400">
                  Cập nhật
                </span>
                <span>{lastUpdated ?? "Đang cập nhật"}</span>
              </div>
            </div>

            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium tracking-wide">
                  MÀU SẮC
                </label>
                {selectedColor && (
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    {selectedColor}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`h-10 w-10 rounded-full border-2 transition-all ${
                      selectedColor === color
                        ? "border-neutral-900 ring-2 ring-neutral-200 dark:border-white dark:ring-neutral-700"
                        : "border-neutral-300 dark:border-neutral-700"
                    }`}
                    style={getColorSwatchStyle(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>

            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium tracking-wide">
                  KÍCH CỠ
                </label>
                {selectedSize && (
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
                    Đã chọn {selectedSize}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-5 gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`border py-3 text-sm font-medium transition-colors ${
                      selectedSize === size
                        ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                        : "border-neutral-300 hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-white"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <label className="mb-3 block text-sm font-medium tracking-wide">
                SỐ LƯỢNG
              </label>
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-neutral-300 dark:border-neutral-700">
                  <button
                    onClick={() =>
                      setQuantity((currentValue) =>
                        Math.max(1, currentValue - 1),
                      )
                    }
                    className="px-4 py-2 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    -
                  </button>
                  <span className="border-x border-neutral-300 px-6 py-2 dark:border-neutral-700">
                    {quantity}
                  </span>
                  <button
                    onClick={() =>
                      setQuantity((currentValue) => currentValue + 1)
                    }
                    className="px-4 py-2 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="mb-8 space-y-3">
              <button
                onClick={() => {
                  void handleAddToCart();
                }}
                className="block w-full bg-neutral-900 py-4 text-center font-medium tracking-wide text-white transition-colors hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                THÊM VÀO GIỎ
              </button>
              <button
                onClick={() => void handleBuyNow()}
                className="w-full border border-neutral-900 py-4 font-medium tracking-wide text-neutral-900 transition-colors hover:bg-neutral-50 dark:border-white dark:text-white dark:hover:bg-neutral-800"
              >
                MUA NGAY
              </button>
            </div>

            <div className="space-y-3 border-b border-neutral-200 pb-8 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                <span className="text-sm">
                  Miễn phí vận chuyển cho đơn hàng trên 1.000.000 VND
                </span>
              </div>
              <div className="flex items-center gap-3">
                <RotateCcw className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                <span className="text-sm">Đổi trả trong 30 ngày</span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                <span className="text-sm">Bảo đảm sản phẩm chính hãng</span>
              </div>
            </div>
          </div>
        </div>

        <section className="mx-[-1rem] mt-16 bg-gradient-to-b from-blue-50/30 to-white px-4 py-12 dark:from-blue-950/10 dark:to-neutral-900 sm:mx-[-1.5rem] sm:px-6 lg:mx-[-2rem] lg:px-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900">
              <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-light tracking-wide">
                Sản phẩm liên quan
              </h2>
              <p className="flex items-center gap-1 text-sm text-neutral-600 dark:text-neutral-400">
                <Sparkles className="h-3 w-3" />
                Gợi ý từ nhóm cùng danh mục
              </p>
            </div>
          </div>

          {relatedProducts.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct.id} product={relatedProduct} />
              ))}
            </div>
          ) : (
            <p className="text-neutral-600 dark:text-neutral-400">
              Chưa có sản phẩm liên quan phù hợp.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
