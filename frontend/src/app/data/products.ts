export type ProductSort = "featured" | "newest" | "price_asc" | "price_desc";

export interface CatalogQuery {
  category?: string;
  subcategory?: string[];
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  isNew?: boolean;
  isSale?: boolean;
  sort?: ProductSort;
}

export interface CategoryNode {
  id?: number;
  slug: string;
  name: string;
  parentSlug?: string | null;
  productCount?: number;
  children?: CategoryNode[];
}

export interface Product {
  id: string;
  slug?: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  images?: string[];
  category: string;
  categoryName?: string;
  subcategory: string;
  subcategoryName?: string;
  rating: number;
  reviews: number;
  colors: string[];
  sizes: string[];
  description: string;
  isNew?: boolean;
  isBestSeller?: boolean;
  isTrending?: boolean;
  createdAt?: string;
  brandName?: string | null;
  stockQuantity?: number;
}

export const products: Product[] = [
  {
    id: "1",
    name: "Áo Thun Trắng Classic",
    price: 299000,
    image:
      "https://images.unsplash.com/photo-1618677603544-51162346e165?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwd2hpdGUlMjB0c2hpcnQlMjBjbG90aGluZ3xlbnwxfHx8fDE3NzQ2ODYxMzF8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "unisex",
    subcategory: "ao-thun",
    rating: 4.8,
    reviews: 342,
    colors: ["Trắng", "Đen", "Xám"],
    sizes: ["XS", "S", "M", "L", "XL"],
    description:
      "Áo thun thiết yếu vượt thời gian được làm từ cotton cao cấp. Hoàn hảo cho trang phục hàng ngày với form dáng thoải mái, dễ chịu.",
    isBestSeller: true,
    isTrending: true,
  },
  {
    id: "2",
    name: "Áo Len Cashmere",
    price: 899000,
    originalPrice: 1299000,
    image:
      "https://images.unsplash.com/photo-1759873821397-433b7ea0eb7c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWlnZSUyMHN3ZWF0ZXIlMjBmYXNoaW9uJTIwbW9kZWx8ZW58MXx8fHwxNzc0Njg2MTMxfDA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "women",
    subcategory: "ao-len",
    rating: 4.9,
    reviews: 189,
    colors: ["Be", "Kem", "Đen"],
    sizes: ["XS", "S", "M", "L"],
    description:
      "Áo len cashmere mềm mại sang trọng với thiết kế hiện đại. Sự ấm áp nhẹ nhàng cho mọi mùa.",
    isNew: true,
    isTrending: true,
  },
  {
    id: "3",
    name: "Quần Jean Đen Slim Fit",
    price: 799000,
    image:
      "https://images.unsplash.com/photo-1744383390068-abfc7bc7fd07?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMGRlbmltJTIwamVhbnMlMjBmYXNoaW9ufGVufDF8fHx8MTc3NDY0MTg0MHww&ixlib=rb-4.1.0&q=80&w=1080",
    category: "unisex",
    subcategory: "quan",
    rating: 4.7,
    reviews: 456,
    colors: ["Đen", "Xanh đậm", "Xanh nhạt"],
    sizes: ["28", "30", "32", "34", "36"],
    description:
      "Vải denim cao cấp có độ co giãn thoải mái. Quần jean đen đa năng phù hợp với mọi trang phục.",
    isBestSeller: true,
  },
  {
    id: "4",
    name: "Áo Khoác Dạ Len",
    price: 2499000,
    image:
      "https://images.unsplash.com/photo-1763385230031-ea852e0858cd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXV0cmFsJTIwY29hdCUyMGphY2tldCUyMGZhc2hpb258ZW58MXx8fHwxNzc0Njg2MTMyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "unisex",
    subcategory: "ao-khoac",
    rating: 4.9,
    reviews: 124,
    colors: ["Be", "Đen", "Xanh navy"],
    sizes: ["XS", "S", "M", "L", "XL"],
    description:
      "Áo khoác len sang trọng với thiết kế cổ điển. Lớp hoàn thiện chống nước cho mọi thời tiết.",
    isNew: true,
    isBestSeller: true,
  },
  {
    id: "5",
    name: "Váy Midi Vải Lanh",
    price: 1199000,
    image:
      "https://images.unsplash.com/photo-1769107805528-964f4de0e342?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3aGl0ZSUyMGRyZXNzJTIwbWluaW1hbGlzdCUyMGZhc2hpb258ZW58MXx8fHwxNzc0Njg2MTMyfDA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "women",
    subcategory: "vay",
    rating: 4.8,
    reviews: 267,
    colors: ["Trắng", "Cát", "Xám nhạt"],
    sizes: ["XS", "S", "M", "L"],
    description:
      "Váy vải lanh thoáng mát với độ dài midi thanh lịch. Hoàn hảo cho thời tiết ấm với form dáng thoải mái.",
    isTrending: true,
  },
  {
    id: "6",
    name: "Sơ Mi Oxford Cotton",
    price: 599000,
    image:
      "https://images.unsplash.com/photo-1722926628555-252c1c0258bf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxncmF5JTIwY2FzdWFsJTIwc2hpcnQlMjBjbG90aGluZ3xlbnwxfHx8fDE3NzQ2ODYxMzJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "men",
    subcategory: "ao-so-mi",
    rating: 4.6,
    reviews: 301,
    colors: ["Trắng", "Xanh", "Xám"],
    sizes: ["S", "M", "L", "XL", "XXL"],
    description:
      "Sơ mi cotton oxford cổ điển với form dáng vừa vặn. Sản phẩm đa năng cho cả dịp thường ngày và trang trọng.",
    isBestSeller: true,
  },
  {
    id: "7",
    name: "Quần Tây May Đo",
    price: 999000,
    originalPrice: 1399000,
    image:
      "https://images.unsplash.com/photo-1766056278792-d5b15656b7e8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiZWlnZSUyMHRyb3VzZXJzJTIwcGFudHMlMjBmYXNoaW9ufGVufDF8fHx8MTc3NDY4NjEzM3ww&ixlib=rb-4.1.0&q=80&w=1080",
    category: "unisex",
    subcategory: "quan",
    rating: 4.7,
    reviews: 198,
    colors: ["Be", "Đen", "Xanh navy", "Xám"],
    sizes: ["28", "30", "32", "34", "36"],
    description:
      "Quần tây may đo hoàn hảo với thiết kế cắt hiện đại. Vải cao cấp giữ form suốt cả ngày.",
    isNew: true,
    isTrending: true,
  },
  {
    id: "8",
    name: "Áo Blazer Hai Hàng Cúc",
    price: 1999000,
    image:
      "https://images.unsplash.com/photo-1770363759232-dc50afcc29a9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxibGFjayUyMGJsYXplciUyMGZvcm1hbCUyMHdlYXJ8ZW58MXx8fHwxNzc0Njc3OTk0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "women",
    subcategory: "ao-khoac",
    rating: 4.9,
    reviews: 156,
    colors: ["Đen", "Xanh navy", "Xám than"],
    sizes: ["XS", "S", "M", "L"],
    description:
      "Áo blazer có cấu trúc với đường nét sắc sảo. Nâng tầm mọi trang phục với món đồ nổi bật này.",
    isBestSeller: true,
  },
  {
    id: "9",
    name: "Áo Cardigan Len Dày",
    price: 1099000,
    image:
      "https://images.unsplash.com/photo-1764697907449-457a99bfe4d6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrbml0JTIwc3dlYXRlciUyMG5ldXRyYWwlMjB0b25lc3xlbnwxfHx8fDE3NzQ2MDAyNjJ8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "unisex",
    subcategory: "ao-len",
    rating: 4.8,
    reviews: 223,
    colors: ["Kem", "Xám", "Nâu lạc đà"],
    sizes: ["S", "M", "L", "XL"],
    description:
      "Áo cardigan rộng ấm áp với kết cấu len dày. Lớp áo hoàn hảo cho những ngày mát mẻ.",
    isTrending: true,
  },
  {
    id: "10",
    name: "Giày Sneaker Da",
    price: 1399000,
    image:
      "https://images.unsplash.com/photo-1772808800357-25b62a1f3974?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjYXN1YWwlMjB3aGl0ZSUyMHNuZWFrZXJzJTIwc2hvZXN8ZW58MXx8fHwxNzc0Njg2MTM0fDA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "unisex",
    subcategory: "giay",
    rating: 4.9,
    reviews: 512,
    colors: ["Trắng", "Đen", "Xám"],
    sizes: ["36", "37", "38", "39", "40", "41", "42", "43"],
    description:
      "Giày sneaker da cao cấp với thiết kế tối giản. Đệm êm ái cho sự thoải mái cả ngày.",
    isBestSeller: true,
    isTrending: true,
  },
  {
    id: "11",
    name: "Áo Hoodie Oversize",
    price: 699000,
    image:
      "https://images.unsplash.com/photo-1709745490680-eb2d7c94a196?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxvdmVyc2l6ZWQlMjBob29kaWUlMjBzdHJlZXR3ZWFyJTIwbmV1dHJhbHxlbnwxfHx8fDE3NzQ2ODYxMzV8MA&ixlib=rb-4.1.0&q=80&w=1080",
    category: "unisex",
    subcategory: "ao-thun",
    rating: 4.7,
    reviews: 389,
    colors: ["Be", "Xám", "Đen", "Trắng"],
    sizes: ["S", "M", "L", "XL"],
    description:
      "Áo hoodie form rộng với lớp lót nỉ cao cấp. Sản phẩm thoải mái tối thượng cho trang phục thường ngày.",
    isNew: true,
    isTrending: true,
  },
];

export const heroImage =
  "https://images.unsplash.com/photo-1667461142431-3dc531363ac9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwZmFzaGlvbiUyMGhlcm8lMjBiYW5uZXJ8ZW58MXx8fHwxNzc0Njg2MTM1fDA&ixlib=rb-4.1.0&q=80&w=1080";

const categoryBlueprint: CategoryNode[] = [
  {
    slug: "women",
    name: "Thoi Trang Nu",
    parentSlug: null,
    children: [
      { slug: "ao-len", name: "Ao Len", parentSlug: "women" },
      { slug: "ao-khoac", name: "Ao Khoac", parentSlug: "women" },
      { slug: "vay", name: "Vay", parentSlug: "women" },
    ],
  },
  {
    slug: "men",
    name: "Thoi Trang Nam",
    parentSlug: null,
    children: [{ slug: "ao-so-mi", name: "Ao So Mi", parentSlug: "men" }],
  },
  {
    slug: "unisex",
    name: "Thoi Trang Unisex",
    parentSlug: null,
    children: [
      { slug: "ao-thun", name: "Ao Thun", parentSlug: "unisex" },
      { slug: "quan", name: "Quan", parentSlug: "unisex" },
      { slug: "giay", name: "Giay", parentSlug: "unisex" },
    ],
  },
];

function normalizeQueryText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getProductTimestamp(product: Product) {
  if (!product.createdAt) {
    return 0;
  }

  const timestamp = new Date(product.createdAt).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export const fallbackCategories: CategoryNode[] = categoryBlueprint.map(
  (rootCategory) => {
    const children = (rootCategory.children ?? []).map((childCategory) => ({
      ...childCategory,
      productCount: products.filter(
        (product) => product.subcategory === childCategory.slug,
      ).length,
    }));

    return {
      ...rootCategory,
      children,
      productCount: products.filter((product) => {
        if (product.category === rootCategory.slug) {
          return true;
        }

        return children.some((childCategory) => {
          return product.subcategory === childCategory.slug;
        });
      }).length,
    };
  },
);

export function filterProducts(
  sourceProducts: Product[],
  query: CatalogQuery = {},
): Product[] {
  const filteredProducts = [...sourceProducts];
  const searchQuery = query.search?.trim();

  const results = filteredProducts.filter((product) => {
    if (
      query.category &&
      product.category !== query.category &&
      product.subcategory !== query.category
    ) {
      return false;
    }

    if (
      query.subcategory?.length &&
      !query.subcategory.includes(product.subcategory)
    ) {
      return false;
    }

    if (query.isNew && !product.isNew) {
      return false;
    }

    if (query.isSale && product.originalPrice == null) {
      return false;
    }

    if (query.minPrice != null && product.price < query.minPrice) {
      return false;
    }

    if (query.maxPrice != null && product.price > query.maxPrice) {
      return false;
    }

    if (searchQuery) {
      const normalizedQuery = normalizeQueryText(searchQuery);
      const searchableText = normalizeQueryText(
        [
          product.name,
          product.description,
          product.categoryName,
          product.subcategoryName,
        ]
          .filter(Boolean)
          .join(" "),
      );

      if (!searchableText.includes(normalizedQuery)) {
        return false;
      }
    }

    return true;
  });

  switch (query.sort) {
    case "price_asc":
      results.sort((left, right) => left.price - right.price);
      break;
    case "price_desc":
      results.sort((left, right) => right.price - left.price);
      break;
    case "newest":
      results.sort((left, right) => {
        const createdAtDiff =
          getProductTimestamp(right) - getProductTimestamp(left);

        if (createdAtDiff !== 0) {
          return createdAtDiff;
        }

        return Number(Boolean(right.isNew)) - Number(Boolean(left.isNew));
      });
      break;
    default:
      break;
  }

  return results;
}

export function getAIRecommendations(
  userId?: string,
  viewedProducts: string[] = [],
): Product[] {
  // Build a simple recommendation set from trending and best-seller products.
  return products
    .filter((p) => p.isTrending || p.isBestSeller)
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);
}

export function getRelatedProducts(productId: string): Product[] {
  const product = products.find((p) => p.id === productId);
  if (!product) return [];

  // Return items from the same category, excluding the current product.
  return products
    .filter((p) => p.id !== productId && p.category === product.category)
    .slice(0, 4);
}
