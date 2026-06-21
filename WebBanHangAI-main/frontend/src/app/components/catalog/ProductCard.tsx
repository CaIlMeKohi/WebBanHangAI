import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { Heart, ShoppingBag, Star } from "lucide-react";

import { useAdminAuth } from "../../context/AdminAuthContext";
import type { Product } from "../../data/products";
import { addCartItem, addWishlistItem, recordRecommendationClick } from "../../lib/api";
import { dispatchCartAddedNotice } from "../../lib/cartNotice";
import { CART_UPDATED_EVENT, addStoredCartItem } from "../../lib/cartStorage";
import { formatCurrency } from "../../lib/productPresentation";
import {
  addStoredWishlistId,
  readStoredWishlistIds,
  WISHLIST_UPDATED_EVENT,
  removeStoredWishlistId,
} from "../../lib/wishlistStorage";

interface ProductCardProps {
  product: Product;
  isRecommendation?: boolean;
}

export function ProductCard({ product, isRecommendation = false }: ProductCardProps) {
  const [isLiked, setIsLiked] = useState(false);
  const { userId } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const discountPercent = product.discountPercent ?? (
    product.originalPrice && product.originalPrice > product.price
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : 0
  );

  const redirectToLogin = () => {
    const next = `${location.pathname}${location.search}`;
    navigate(`/login?next=${encodeURIComponent(next)}`);
  };

  useEffect(() => {
    const syncLikedState = () => {
      setIsLiked(readStoredWishlistIds().includes(String(product.id)));
    };

    syncLikedState();
    window.addEventListener(WISHLIST_UPDATED_EVENT, syncLikedState);
    return () =>
      window.removeEventListener(WISHLIST_UPDATED_EVENT, syncLikedState);
  }, [product.id]);

  const handleQuickAdd = async () => {
    const size = product.sizes[0] ?? "STD";
    const color = product.colors[0] ?? "Mặc định";

    if (!userId) {
      redirectToLogin();
      return;
    }

    try {
      await addCartItem({
        user_id: userId,
        product_id: product.id,
        quantity: 1,
        size,
        color,
      });
    } catch {
      addStoredCartItem({ id: String(product.id), quantity: 1, size, color });
    }

    window.dispatchEvent(new Event(CART_UPDATED_EVENT));
    dispatchCartAddedNotice();
  };

  const handleWishlist = () => {
    if (userId) {
      if (isLiked) {
        removeStoredWishlistId(String(product.id));
        setIsLiked(false);
        return;
      }

      addStoredWishlistId(String(product.id));
      setIsLiked(true);
      void addWishlistItem(userId, product.id).catch(() => undefined);
      return;
    }

    redirectToLogin();
  };

  return (
    <Link
      to={`/product/${product.id}`}
      className="group block"
      onClick={() => {
        if (isRecommendation && userId) {
          void recordRecommendationClick(product.id).catch(() => undefined);
        }
      }}
    >
      <div className="relative mb-3 aspect-[4/5] overflow-hidden bg-neutral-100 dark:bg-neutral-800">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />

        <div className="absolute left-3 top-3 flex flex-col gap-2">
          {product.isNew && (
            <span className="bg-white px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-neutral-900">
              Mới
            </span>
          )}
          {product.originalPrice && discountPercent > 0 && (
            <span className="bg-neutral-900 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-white">
              Giảm {discountPercent}%
            </span>
          )}
        </div>

        <button
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handleWishlist();
          }}
          className="absolute right-3 top-3 rounded-full bg-white/95 p-2 opacity-0 shadow-sm transition-all duration-200 group-hover:opacity-100 hover:scale-105"
          aria-label="Thêm vào yêu thích"
        >
          <Heart
            className={`h-4 w-4 ${
              isLiked ? "fill-red-500 text-red-500" : "text-neutral-900"
            }`}
          />
        </button>

        <div className="absolute inset-x-0 bottom-0 p-3 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void handleQuickAdd();
            }}
            className="flex w-full items-center justify-center gap-2 bg-white py-3 text-xs font-medium uppercase tracking-wide text-neutral-900 shadow-sm transition-colors hover:bg-neutral-900 hover:text-white"
          >
            <ShoppingBag className="h-4 w-4" />
            Thêm nhanh
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
          {product.brandName ?? product.categoryName ?? "Bộ sưu tập"}
        </div>
        <h3 className="line-clamp-2 text-sm font-medium text-neutral-900 transition-colors group-hover:text-neutral-600 dark:text-neutral-100 dark:group-hover:text-white">
          {product.name}
        </h3>

        <div className="flex items-center gap-1">
          <div className="flex">
            {[...Array(5)].map((_, index) => (
              <Star
                key={index}
                className={`h-3 w-3 ${
                  index < Math.floor(product.rating)
                    ? "fill-neutral-900 text-neutral-900 dark:fill-white dark:text-white"
                    : "text-neutral-300 dark:text-neutral-600"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">({product.reviews})</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-900 dark:text-white">
            {formatCurrency(product.price)}
          </span>
          {product.originalPrice && (
            <span className="text-sm text-neutral-400 line-through dark:text-neutral-500">
              {formatCurrency(product.originalPrice)}
            </span>
          )}
        </div>

      </div>
    </Link>
  );
}
