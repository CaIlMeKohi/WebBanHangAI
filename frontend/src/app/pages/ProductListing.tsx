import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { SlidersHorizontal, X } from "lucide-react";

import { ProductCard } from "../components/ProductCard";
import { Slider } from "../components/ui/slider";
import {
  fallbackCategories,
  type CatalogQuery,
  type CategoryNode,
  type ProductSort,
} from "../data/products";
import { useCatalog } from "../hooks/useCatalog";
import { fetchCategories } from "../lib/api";
import { formatCurrency } from "../lib/productPresentation";

const MIN_PRICE = 0;
const MAX_PRICE = 3_000_000;

const sortOptions: Array<{ value: ProductSort; label: string }> = [
  { value: "featured", label: "Noi bat" },
  { value: "newest", label: "Moi nhat" },
  { value: "price_asc", label: "Gia tang dan" },
  { value: "price_desc", label: "Gia giam dan" },
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
  const [categories, setCategories] = useState<CategoryNode[]>(fallbackCategories);

  const category = searchParams.get("category") ?? undefined;
  const searchQuery = searchParams.get("search") ?? undefined;
  const isNew = ["true", "1"].includes(searchParams.get("new") ?? "");
  const isSale = ["true", "1"].includes(searchParams.get("sale") ?? "");

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const apiCategories = await fetchCategories();
        if (isMounted && apiCategories.length > 0) {
          setCategories(apiCategories);
        }
      } catch {
        if (isMounted) {
          setCategories(fallbackCategories);
        }
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
    };
  }, [category, isNew, isSale, priceRange, searchQuery, selectedSubcategories, sortBy]);

  const { products, isLoading } = useCatalog(catalogQuery);

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

  const resetLocalFilters = () => {
    setSelectedSubcategories([]);
    setPriceRange([MIN_PRICE, MAX_PRICE]);
    setSortBy("featured");
  };

  const pageTitle = (() => {
    if (searchQuery) {
      return `Ket qua tim kiem "${searchQuery}"`;
    }
    if (isNew) {
      return "San pham moi nhat";
    }
    if (isSale) {
      return "San pham dang giam gia";
    }
    if (activeRootCategory) {
      return activeRootCategory.name;
    }
    return "Tat ca san pham";
  })();

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-light tracking-wide">{pageTitle}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
            <span>{products.length} san pham</span>
            {isLoading && <span>Dang cap nhat du lieu tu API...</span>}
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4 dark:border-neutral-800">
          <button
            onClick={() => setShowFilters((currentValue) => !currentValue)}
            className="flex items-center gap-2 border border-neutral-300 px-4 py-2 transition-colors hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="text-sm font-medium">Bo loc</span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-neutral-900 px-2 py-0.5 text-xs text-white dark:bg-white dark:text-neutral-900">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              Sap xep:
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
            <aside className="w-72 shrink-0">
              <div className="sticky top-20 space-y-6">
                <div>
                  <h3 className="mb-3 text-sm font-medium tracking-wide">
                    DANH MUC CHINH
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
                      Tat ca
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
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-medium tracking-wide">
                    DANH MUC SAN PHAM
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
                    KHOANG GIA
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
                    Xoa bo loc cuc bo
                  </button>
                )}
              </div>
            </aside>
          )}

          <div className="flex-1">
            {products.length > 0 ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="mb-4 text-neutral-600 dark:text-neutral-400">
                  Khong tim thay san pham phu hop voi bo loc hien tai.
                </p>
                <button
                  onClick={resetLocalFilters}
                  className="text-sm font-medium underline"
                >
                  Dat lai bo loc
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
