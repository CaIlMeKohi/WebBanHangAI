import { Link } from "react-router";
import { Heart, Star } from "lucide-react";
import { useState } from "react";

import type { Product } from "../data/products";
import {
  formatCurrency,
  getColorSwatchStyle,
} from "../lib/productPresentation";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const [isLiked, setIsLiked] = useState(false);

  return (
    <Link to={`/product/${product.id}`} className="group block">
      <div className="relative mb-3 aspect-[3/4] overflow-hidden bg-neutral-100">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <div className="absolute left-3 top-3 flex flex-col gap-2">
          {product.isNew && (
            <span className="bg-white px-3 py-1 text-xs font-medium tracking-wide text-neutral-900">
              MOI
            </span>
          )}
          {product.originalPrice && (
            <span className="bg-red-600 px-3 py-1 text-xs font-medium tracking-wide text-white">
              GIAM GIA
            </span>
          )}
        </div>

        <button
          onClick={(event) => {
            event.preventDefault();
            setIsLiked((currentValue) => !currentValue);
          }}
          className="absolute right-3 top-3 rounded-full bg-white p-2 opacity-0 transition-all duration-200 group-hover:opacity-100 hover:scale-110"
        >
          <Heart
            className={`h-4 w-4 ${
              isLiked ? "fill-red-500 text-red-500" : "text-neutral-900"
            }`}
          />
        </button>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={(event) => {
              event.preventDefault();
            }}
            className="w-full bg-white py-2 text-sm font-medium tracking-wide text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
          >
            THEM NHANH
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-medium text-neutral-900 transition-colors group-hover:text-neutral-600">
          {product.name}
        </h3>

        <div className="flex items-center gap-1">
          <div className="flex">
            {[...Array(5)].map((_, index) => (
              <Star
                key={index}
                className={`h-3 w-3 ${
                  index < Math.floor(product.rating)
                    ? "fill-neutral-900 text-neutral-900"
                    : "text-neutral-300"
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-neutral-500">({product.reviews})</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-900">
            {formatCurrency(product.price)}
          </span>
          {product.originalPrice && (
            <span className="text-sm text-neutral-400 line-through">
              {formatCurrency(product.originalPrice)}
            </span>
          )}
        </div>

        <div className="flex gap-1 pt-1">
          {product.colors.slice(0, 4).map((color) => (
            <div
              key={color}
              className="h-4 w-4 rounded-full border border-neutral-300"
              style={getColorSwatchStyle(color)}
              title={color}
            />
          ))}
        </div>
      </div>
    </Link>
  );
}
