import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { SlidersHorizontal, X } from "lucide-react";

import { ProductCard } from "../../components/catalog/ProductCard";
import { Slider } from "../../components/ui/slider";
import {
  type CatalogQuery,
  type CategoryNode,
  type ProductSort,
} from "../../data/products";
import { useCatalog } from "../../hooks/useCatalog";
import { fetchCategories } from "../../lib/api";
import { formatCurrency } from "../../lib/productPresentation";

const MIN_PRICE = 0;
const MAX_PRICE = 3_000_000;
const PAGE_SIZE = 20;

const sortOptions: Array<{ value: ProductSort; label: string }> = [
  { value: "featured", label: "Nổi bật" },
  { value: "newest", label: "Mới nhất" },
  { value: "price_asc", label: "Giá tăng dần" },
  { value: "price_desc", label: "Giá giảm dần" },
];

function flattenChildCategories(categories: CategoryNode[]) {
  return categories.flatMap((category) => category.children ?? []);
}

export function ProductListing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(true);
  const [priceRange, setPriceRange] = useState([MIN_PRICE, MAX_PRICE]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>(
    [],
  );
  const [sortBy, setSortBy] = useState<ProductSort>("featured");
  const [categories, setCategories] = useState<CategoryNode[]>([]);

  const category = searchParams.get("category") ?? undefined;
  const searchQuery = searchParams.get("search") ?? undefined;
  const isNew = ["true", "1"].includes(searchParams.get("new") ?? "");
  const isSale = ["true", "1"].includes(searchParams.get("sale") ?? "");
  const currentPage = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const apiCategories = await fetchCategories();
        if (isMounted && apiCategories.length > 0) {
          setCategories(apiCategories);
        }
      } catch {
        if (isMounted) setCategories([]);
      }
    }

    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeRootCategory = useMemo(() => {
    return categories.find((item) => item.slug === category);
  }, [categories, category]);

  const availableSubcategories = useMemo(() => {
    if (activeRootCategory?.children?.length) {
      return activeRootCategory.children;
    }

    return flattenChildCategories(categories);
  }, [activeRootCategory, categories]);

  useEffect(() => {
    const allowedSlugs = new Set(availableSubcategories.map((item) => item.slug));
    setSelectedSubcategories((currentValue) =>
      currentValue.filter((slug) => allowedSlugs.has(slug)),
    );
  }, [availableSubcategories]);

  const catalogQuery = useMemo<CatalogQuery>(() => {
    return {
      category,
      search: searchQuery,
      isNew,
      isSale,
      subcategory:
        selectedSubcategories.length > 0 ? selectedSubcategories : undefined,
      minPrice: priceRange[0] > MIN_PRICE ? priceRange[0] : undefined,
      maxPrice: priceRange[1] < MAX_PRICE ? priceRange[1] : undefined,
      sort: sortBy,
      page: currentPage,
    };
  }, [category, currentPage, isNew, isSale, priceRange, searchQuery, selectedSubcategories, sortBy]);

  const { products, totalCount, isLoading, error } = useCatalog(catalogQuery);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const activeFilterCount =
    selectedSubcategories.length +
    Number(priceRange[0] > MIN_PRICE || priceRange[1] < MAX_PRICE);

  const handleRootCategoryChange = (nextCategory?: string) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    if (nextCategory) {
      nextSearchParams.set("category", nextCategory);
    } else {
      nextSearchParams.delete("category");
    }

    setSearchParams(nextSearchParams);
    setSelectedSubcategories([]);
  };

  const toggleSubcategory = (subcategorySlug: string) => {
    setSelectedSubcategories((currentValue) => {
      if (currentValue.includes(subcategorySlug)) {
        return currentValue.filter((slug) => slug !== subcategorySlug);
      }

      return [...currentValue, subcategorySlug];
    });
  };

  const goToPage = (page: number) => {
    const nextSearchParams = new URLSearchParams(searchParams);
    if (page <= 1) {
      nextSearchParams.delete("page");
    } else {
      nextSearchParams.set("page", String(page));
    }
    setSearchParams(nextSearchParams);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetLocalFilters = () => {
    setSelectedSubcategories([]);
    setPriceRange([MIN_PRICE, MAX_PRICE]);
    setSortBy("featured");
    goToPage(1);
  };

  const pageTitle = (() => {
    if (searchQuery) {
      return `Kết quả tìm kiếm "${searchQuery}"`;
    }
    if (isNew) {
      return "Sản phẩm mới nhất";
    }
    if (isSale) {
      return "Sản phẩm đang giảm giá";
    }
    if (activeRootCategory) {
      return activeRootCategory.name;
    }
    return "Tất cả sản phẩm";
  })();

  return (
    <div className="min-h-screen bg-white text-neutral-950 dark:bg-neutral-900 dark:text-white">
      <div className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-2 text-xs uppercase tracking-[0.22em] text-neutral-500">
            Collection
          </div>
          <h1 className="text-4xl font-light tracking-wide">{pageTitle}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            <span>{totalCount.toLocaleString("vi-VN")} sản phẩm</span>
            {isLoading && <span>Đang cập nhật dữ liệu từ API...</span>}
            {error && <span className="text-red-600">{error}</span>}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <button
            onClick={() => setShowFilters((currentValue) => !currentValue)}
            className="flex items-center gap-2 border border-neutral-300 px-4 py-2 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="text-sm font-medium">Bộ lọc</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs text-white dark:bg-white dark:text-neutral-900">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Sắp xếp:
            </span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as ProductSort)}
              className="border border-neutral-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:border-neutral-700 dark:bg-neutral-800 dark:focus:ring-neutral-400"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-8">
          {showFilters && (
            <aside className="hidden w-64 shrink-0 md:block">
              <div className="sticky top-20 space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-medium tracking-wide">
                    DANH MỤC CHÍNH
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleRootCategoryChange(undefined)}
                      className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                        !category
                          ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                          : "border-neutral-300 hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-white"
                      }`}
                    >
                      Tất cả
                    </button>
                    {categories.map((rootCategory) => (
                      <button
                        key={rootCategory.slug}
                        onClick={() => handleRootCategoryChange(rootCategory.slug)}
                        className={`rounded-full border px-3 py-2 text-sm transition-colors ${
                          category === rootCategory.slug
                            ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                            : "border-neutral-300 hover:border-neutral-900 dark:border-neutral-700 dark:hover:border-white"
                        }`}
                      >
                        {rootCategory.name}
                      </button>
                    ))}
                    {categories.length === 0 && (
                      <span className="text-sm text-neutral-500">
                        Chưa có danh mục từ DB
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-medium tracking-wide">
                    DANH MỤC SẢN PHẨM
                  </h3>
                  <div className="space-y-2">
                    {availableSubcategories.map((subcategory) => (
                      <label
                        key={subcategory.slug}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSubcategories.includes(subcategory.slug)}
                          onChange={() => toggleSubcategory(subcategory.slug)}
                          className="h-4 w-4 rounded border-neutral-300 focus:ring-2 focus:ring-neutral-900"
                        />
                        <span className="text-sm">
                          {subcategory.name}
                          {typeof subcategory.productCount === "number" && (
                            <span className="ml-1 text-neutral-400">
                              ({subcategory.productCount})
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-medium tracking-wide">
                    KHOẢNG GIÁ
                  </h3>
                  <div className="px-2">
                    <Slider
                      value={priceRange}
                      onValueChange={(nextValue) => setPriceRange(nextValue)}
                      min={MIN_PRICE}
                      max={MAX_PRICE}
                      step={100_000}
                      className="mb-3"
                    />
                    <div className="flex justify-between gap-4 text-sm text-neutral-600 dark:text-neutral-400">
                      <span>{formatCurrency(priceRange[0])}</span>
                      <span>{formatCurrency(priceRange[1])}</span>
                    </div>
                  </div>
                </div>

                {(activeFilterCount > 0 || sortBy !== "featured") && (
                  <button
                    onClick={resetLocalFilters}
                    className="flex w-full items-center justify-center gap-2 border border-neutral-300 py-2 text-sm font-medium transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                  >
                    <X className="h-4 w-4" />
                    Xóa bộ lọc cục bộ
                  </button>
                )}
              </div>
            </aside>
          )}

          <div className="flex-1">
            {products.length > 0 ? (
              <>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="border border-neutral-300 px-4 py-2 text-sm disabled:opacity-40"
                    >
                      Trước
                    </button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`h-10 w-10 border text-sm ${
                          page === currentPage
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-300"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="border border-neutral-300 px-4 py-2 text-sm disabled:opacity-40"
                    >
                      Sau
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="py-16 text-center">
                <p className="mb-4 text-neutral-600 dark:text-neutral-400">
                  Không tìm thấy sản phẩm phù hợp với bộ lọc hiện tại.
                </p>
                <button
                  onClick={resetLocalFilters}
                  className="text-sm font-medium underline"
                >
                  Đặt lại bộ lọc
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
