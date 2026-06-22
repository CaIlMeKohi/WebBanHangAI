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
  Trash2,
  Truck,
} from "lucide-react";

import { ProductCard } from "../../components/catalog/ProductCard";
import type { Product } from "../../data/products";
import {
  addCartItem,
  addWishlistItem,
  deleteProductReview,
  fetchProductById,
  fetchProductReviews,
  fetchRelatedProducts,
  fetchWishlist,
  type ProductReview,
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
  const { userId, role } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState<Product | undefined>();
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [reviewToDelete, setReviewToDelete] = useState<ProductReview | null>(null);
  const [reviewDeleteError, setReviewDeleteError] = useState("");
  const [isDeletingReview, setIsDeletingReview] = useState(false);
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
        const [apiRelated, apiReviews] = await Promise.all([
          fetchRelatedProducts(id as string, 4).catch(() => []),
          fetchProductReviews(id as string).catch(() => []),
        ]);
        if (isMounted) {
          setProduct(apiProduct);
          setRelatedProducts(apiRelated);
          setReviews(apiReviews);
        }
      } catch {
        if (isMounted) {
          setProduct(undefined);
          setRelatedProducts([]);
          setReviews([]);
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
  const reviewAverage = reviews.length
    ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
    : Number(product.rating || 0);
  const reviewTotal = reviews.length || Number(product.reviews || 0);
  const reviewDistribution = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: reviews.filter((review) => review.rating === rating).length,
  }));

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

  const handleDeleteReview = async () => {
    if (!reviewToDelete || !id || role !== "admin") return;
    setIsDeletingReview(true);
    setReviewDeleteError("");
    try {
      await deleteProductReview(reviewToDelete.review_id);
      const [nextReviews, nextProduct] = await Promise.all([
        fetchProductReviews(id).catch(() => []),
        fetchProductById(id),
      ]);
      setReviews(nextReviews);
      setProduct(nextProduct);
      setReviewToDelete(null);
    } catch (error) {
      setReviewDeleteError(error instanceof Error ? error.message : "Không thể xóa đánh giá.");
    } finally {
      setIsDeletingReview(false);
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

        <section className="mt-16 border-t border-neutral-200 pt-12 dark:border-neutral-800">
          <div className="mb-8">
            <h2 className="text-2xl font-light tracking-wide">Đánh giá sản phẩm</h2>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              Đánh giá từ khách hàng đã mua sản phẩm
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-[280px_1fr]">
            <div className="lg:border-r lg:border-neutral-200 lg:pr-10 dark:lg:border-neutral-800">
              <div className="flex items-end gap-2">
                <strong className="text-5xl font-light leading-none">{reviewAverage.toFixed(1)}</strong>
                <span className="pb-1 text-sm text-neutral-500">/ 5</span>
              </div>
              <div className="mt-3 flex gap-1" aria-label={`${reviewAverage.toFixed(1)} trên 5 sao`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${star <= Math.round(reviewAverage) ? "fill-neutral-900 text-neutral-900 dark:fill-white dark:text-white" : "text-neutral-300 dark:text-neutral-700"}`}
                  />
                ))}
              </div>
              <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                {reviewTotal} đánh giá
              </p>

              <div className="mt-6 space-y-2.5">
                {reviewDistribution.map(({ rating, count }) => (
                  <div key={rating} className="grid grid-cols-[28px_1fr_26px] items-center gap-2 text-xs">
                    <span>{rating}★</span>
                    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className="h-full rounded-full bg-neutral-900 dark:bg-white"
                        style={{ width: `${reviews.length ? (count / reviews.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-right text-neutral-500">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              {reviews.length > 0 ? (
                <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {reviews.map((review) => (
                    <article key={review.review_id} className="py-6 first:pt-0">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">Khách hàng #{review.user_id ?? "-"}</div>
                          <div className="mt-1 flex gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-4 w-4 ${star <= review.rating ? "fill-neutral-900 text-neutral-900 dark:fill-white dark:text-white" : "text-neutral-300 dark:text-neutral-700"}`}
                              />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {review.created_at && (
                            <time className="text-xs text-neutral-500">
                              {new Date(review.created_at).toLocaleDateString("vi-VN")}
                            </time>
                          )}
                          {role === "admin" && (
                            <button
                              type="button"
                              onClick={() => {
                                setReviewToDelete(review);
                                setReviewDeleteError("");
                              }}
                              className="inline-flex items-center gap-1.5 rounded border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Xóa
                            </button>
                          )}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                          {review.comment}
                        </p>
                      )}
                      {review.image_urls && review.image_urls.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {review.image_urls.map((imageUrl, index) => (
                            <a key={`${imageUrl}-${index}`} href={imageUrl} target="_blank" rel="noreferrer">
                              <img
                                src={imageUrl}
                                alt={`Ảnh đánh giá ${index + 1}`}
                                className="h-20 w-20 rounded border border-neutral-200 object-cover dark:border-neutral-800"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="border border-dashed border-neutral-300 px-6 py-12 text-center text-sm text-neutral-500 dark:border-neutral-700">
                  {reviewTotal > 0
                    ? "Sản phẩm đã có điểm đánh giá tổng hợp nhưng chưa có nội dung đánh giá chi tiết."
                    : "Sản phẩm chưa có đánh giá từ khách hàng."}
                </div>
              )}
            </div>
          </div>
        </section>

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

        {reviewToDelete && role === "admin" && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-neutral-900">
              <h3 className="text-xl font-medium">Xóa đánh giá</h3>
              <p className="mt-3 text-sm leading-6 text-neutral-600 dark:text-neutral-300">
                Bạn có chắc muốn xóa đánh giá {reviewToDelete.rating} sao này không? Ảnh của đánh giá cũng sẽ bị xóa khỏi Cloudinary.
              </p>
              {reviewDeleteError && (
                <div className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
                  {reviewDeleteError}
                </div>
              )}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  disabled={isDeletingReview}
                  onClick={() => setReviewToDelete(null)}
                  className="rounded border px-4 py-2 text-sm disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={isDeletingReview}
                  onClick={() => void handleDeleteReview()}
                  className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeletingReview ? "Đang xóa..." : "Xóa đánh giá"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
