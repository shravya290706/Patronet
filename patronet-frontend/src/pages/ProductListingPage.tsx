import { useState, useEffect, useMemo } from "react"
import {
  SlidersHorizontal,
  X,
  RotateCcw,
  AlertCircle,
  PackageOpen,
  ChevronDown,
  LayoutGrid,
} from "lucide-react"

import { Container } from "@/components/layout"
import { Breadcrumbs, type BreadcrumbItem, Pagination } from "@/components/ui"
import { ProductCard, ProductGrid, FilterSidebar, type FilterState } from "@/components/products"
import {
  getProductBrands,
  getUiProducts,
  isBackendUuid,
} from "@/services/product.service"
import { getUiCategories } from "@/services/category.service"
import { normalizeApiError } from "@/services/api.errors"
import { mockCatalogProducts } from "@/mocks/products.mock"
import { mockHomepageCategories } from "@/mocks/categories.mock"
import type { UiProductCardModel, UiCategoryModel } from "@/types/ui.types"
import type { ApiProductSortOption } from "@/types/api.types"

export interface ProductListingPageProps {
  initialCategoryId?: string
  initialBrand?: string
  initialSort?: ApiProductSortOption
  onProductClick?: (id: string) => void
  onAddToCart?: (id: string) => void | Promise<void>
  onToggleWishlist?: (id: string) => void | Promise<void>
  wishlistedProductIds?: ReadonlySet<string>
  onNavigateHome?: () => void
}

// Mock brand list used only as dev fallback when API is unreachable
const MOCK_BRANDS = Array.from(
  new Set(mockCatalogProducts.map((p) => p.brand).filter((b): b is string => Boolean(b)))
).sort()

const PAGE_SIZE = 16

export function ProductListingPage({
  initialCategoryId,
  initialBrand,
  initialSort = "newest",
  onProductClick,
  onAddToCart,
  onToggleWishlist,
  wishlistedProductIds,
  onNavigateHome,
}: ProductListingPageProps) {
  // Query parameters state
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [sortOption, setSortOption] = useState<ApiProductSortOption>(initialSort)
  const [filters, setFilters] = useState<FilterState>({
    categoryId: initialCategoryId,
    brand: initialBrand,
    minPrice: undefined,
    maxPrice: undefined,
  })

  // Mobile drawer state
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false)

  // Categories state
  const [categories, setCategories] = useState<UiCategoryModel[]>(mockHomepageCategories)
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(false)

  // Brand list derived from loaded products (real data) or mock fallback
  const [availableBrands, setAvailableBrands] = useState<string[]>(MOCK_BRANDS)
  const [brandLoadError, setBrandLoadError] = useState<string | null>(null)

  // Products UI state
  const [products, setProducts] = useState<UiProductCardModel[]>([])
  const [totalCount, setTotalCount] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(1)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // 1. Fetch categories on mount (with fallback to mock data)
  useEffect(() => {
    let isMounted = true
    async function fetchCategories() {
      setIsCategoriesLoading(true)
      try {
        const data = await getUiCategories()
        if (isMounted && data.length > 0) {
          setCategories(data)
        }
      } catch {
        // Safe fallback to mock categories
        if (isMounted) {
          setCategories(mockHomepageCategories)
        }
      } finally {
        if (isMounted) {
          setIsCategoriesLoading(false)
        }
      }
    }
    fetchCategories()
    return () => {
      isMounted = false
    }
  }, [])

  // Reload trigger for retry
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isMounted = true
    getProductBrands()
      .then((brands) => {
        if (isMounted) {
          setAvailableBrands(brands)
          setBrandLoadError(null)
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setBrandLoadError(normalizeApiError(error).message)
        }
      })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    async function executeLoad() {
      setIsLoading(true)
      setError(null)

      const queryParams = {
        page: currentPage,
        page_size: PAGE_SIZE,
        category_id: isBackendUuid(filters.categoryId)
          ? filters.categoryId
          : undefined,
        brand: filters.brand,
        min_price: filters.minPrice,
        max_price: filters.maxPrice,
        sort: sortOption,
      }

      try {
        const response = await getUiProducts(queryParams)
        if (!isCancelled) {
          setProducts(response.items)
          setTotalCount(response.total)
          setTotalPages(response.totalPages)
        }
      } catch (rawError) {
        const err = normalizeApiError(rawError)
        const isDev = import.meta.env.DEV
        const isNetworkOrConfigError =
          err.isNetworkError || err.statusText === "CONFIG_ERROR"

        // In development mode, allow safe mock fallback ONLY when API is not configured or network is unreachable
        if (isDev && isNetworkOrConfigError) {
          console.warn(
            `[PATRONET PLP] Backend API unreachable or not configured (${err.message}). Using local mock catalog for development.`
          )

          if (!isCancelled) {
            let result = [...mockCatalogProducts]

            if (filters.categoryId) {
              const targetCat = categories.find((c) => c.id === filters.categoryId)
              const targetName = targetCat ? targetCat.name.toLowerCase() : filters.categoryId.toLowerCase()
              result = result.filter(
                (p) =>
                  p.categoryName?.toLowerCase().includes(targetName) ||
                  p.categoryName?.toLowerCase() === targetName
              )
            }

            if (filters.brand) {
              result = result.filter((p) => p.brand === filters.brand)
            }

            if (filters.minPrice !== undefined) {
              result = result.filter((p) => p.price >= filters.minPrice!)
            }

            if (filters.maxPrice !== undefined) {
              result = result.filter((p) => p.price <= filters.maxPrice!)
            }

            if (sortOption === "price_asc") {
              result.sort((a, b) => a.price - b.price)
            } else if (sortOption === "price_desc") {
              result.sort((a, b) => b.price - a.price)
            } else {
              result.sort((a, b) => b.id.localeCompare(a.id))
            }

            const totalItems = result.length
            const calculatedPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
            const startIndex = (currentPage - 1) * PAGE_SIZE
            const paginatedItems = result.slice(startIndex, startIndex + PAGE_SIZE)

            setProducts(paginatedItems)
            setTotalCount(totalItems)
            setTotalPages(calculatedPages)
          }
        } else {
          // Genuine HTTP server error (400, 404, 422, 500, etc.) or production error:
          // Do NOT silently fall back to mock data. Display the error state to the user.
          if (!isCancelled) {
            setProducts([])
            setTotalCount(0)
            setTotalPages(1)
            setError(
              err.message ||
                `Failed to retrieve products from server (HTTP ${err.status}: ${err.statusText})`
            )
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    executeLoad()

    return () => {
      isCancelled = true
    }
  }, [currentPage, filters, sortOption, categories, reloadKey])

  // Count active filter conditions
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.categoryId) count++
    if (filters.brand) count++
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) count++
    return count
  }, [filters])

  // Resolve active category label for breadcrumb & banner
  const activeCategory = useMemo(() => {
    if (!filters.categoryId) return undefined
    return categories.find((c) => c.id === filters.categoryId)
  }, [categories, filters.categoryId])

  // Handle filter changes (resets pagination to page 1)
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  // Handle global filter reset
  const handleResetFilters = () => {
    setFilters({
      categoryId: undefined,
      brand: undefined,
      minPrice: undefined,
      maxPrice: undefined,
    })
    setCurrentPage(1)
  }

  // Handle individual chip removal
  const handleRemoveCategory = () => {
    handleFilterChange({ ...filters, categoryId: undefined })
  }

  const handleRemoveBrand = () => {
    handleFilterChange({ ...filters, brand: undefined })
  }

  const handleRemovePrice = () => {
    handleFilterChange({ ...filters, minPrice: undefined, maxPrice: undefined })
  }

  // Format price range chip
  const priceChipLabel = useMemo(() => {
    if (filters.minPrice !== undefined && filters.maxPrice !== undefined) {
      return `₹${filters.minPrice.toLocaleString("en-IN")} – ₹${filters.maxPrice.toLocaleString("en-IN")}`
    }
    if (filters.minPrice !== undefined) {
      return `Min ₹${filters.minPrice.toLocaleString("en-IN")}`
    }
    if (filters.maxPrice !== undefined) {
      return `Max ₹${filters.maxPrice.toLocaleString("en-IN")}`
    }
    return null
  }, [filters.minPrice, filters.maxPrice])

  // Dynamic breadcrumbs based on active category
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Home", href: "#", onClick: onNavigateHome },
    ...(activeCategory
      ? [
          {
            label: activeCategory.name,
            href: "#",
            onClick: () => handleFilterChange({ ...filters, categoryId: activeCategory.id }),
          },
        ]
      : [{ label: "Catalog", href: "#" }]),
    { label: "All Products" },
  ]

  // Pagination display indices
  const startItemIndex = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const endItemIndex = Math.min(currentPage * PAGE_SIZE, totalCount)

  return (
    <div className="bg-surface min-h-[calc(100vh-120px)] py-space-sm pb-space-xl">
      <Container>
        {/* BREADCRUMBS & SECTION BANNER */}
        <section className="pt-space-md pb-space-xs">
          <Breadcrumbs items={breadcrumbItems} className="mb-space-sm" />

          {/* Catalog Header Banner (Stitch layout & styling) */}
          <div className="bg-surface-container-lowest rounded-xl p-space-lg shadow-sm flex flex-col md:flex-row md:items-end justify-between gap-space-md relative overflow-hidden border border-surface-container/60">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-primary/5 via-secondary-container/5 to-transparent pointer-events-none hidden md:block" />

            <div className="space-y-space-xs relative z-10 max-w-2xl">
              <div className="flex items-center gap-space-sm flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary font-label-sm text-label-sm uppercase tracking-wider font-semibold">
                  Catalog
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed-variant font-label-sm text-label-sm font-semibold">
                  Pan-India Delivery
                </span>
              </div>
              <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold">
                {activeCategory ? activeCategory.name : "All Products & Tech Accessories"}
              </h1>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {activeCategory?.description
                  ? activeCategory.description
                  : "Explore our collection of consumer tech, computing hardware, audio wearables and lifestyle accessories."}
              </p>
            </div>

            <div className="flex flex-col items-start md:items-end flex-shrink-0 relative z-10">
              <span className="font-label-md text-label-md text-outline">Available Items</span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-headline-sm text-headline-sm text-primary font-bold">
                  {totalCount}
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Products Listed
                </span>
              </div>
            </div>
          </div>

          {/* Active Filter Chips Tag Row */}
          <div className="flex items-center justify-between flex-wrap gap-space-sm pt-space-md pb-space-xs">
            <div className="flex items-center flex-wrap gap-space-xs text-body-sm font-body-sm">
              <span className="font-label-md text-label-md text-outline mr-1">
                Active filters:
              </span>

              {activeFilterCount === 0 && (
                <span className="text-on-surface-variant text-body-sm italic">
                  None (showing full catalog)
                </span>
              )}

              {/* Category chip */}
              {activeCategory && (
                <button
                  type="button"
                  onClick={handleRemoveCategory}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-on-primary font-label-md text-label-md hover:bg-primary-container transition-all shadow-xs cursor-pointer"
                  title="Remove category filter"
                >
                  <span>Category: {activeCategory.name}</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Brand chip */}
              {filters.brand && (
                <button
                  type="button"
                  onClick={handleRemoveBrand}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-container text-on-primary font-label-md text-label-md hover:bg-primary transition-all shadow-xs cursor-pointer"
                  title="Remove brand filter"
                >
                  <span>Brand: {filters.brand}</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Price range chip */}
              {priceChipLabel && (
                <button
                  type="button"
                  onClick={handleRemovePrice}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-on-surface font-label-md text-label-md hover:bg-surface-variant transition-all shadow-xs cursor-pointer"
                  title="Remove price filter"
                >
                  <span>{priceChipLabel}</span>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Clear all action */}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="font-label-md text-label-md text-secondary hover:text-on-secondary-container transition-colors font-semibold flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Clear All Filters</span>
              </button>
            )}
          </div>
        </section>

        {/* TWO-COLUMN CATALOG INTERFACE (Stitch: 3 cols sidebar, 9 cols main) */}
        <section className="py-space-sm pb-space-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
            {/* 1. Desktop Left Filter Sidebar */}
            <div className="hidden lg:block lg:col-span-3 sticky top-[136px]">
              <FilterSidebar
                key={`${filters.minPrice ?? ""}:${filters.maxPrice ?? ""}`}
                categories={categories}
                availableBrands={availableBrands}
                brandLoadError={brandLoadError}
                filters={filters}
                onFilterChange={handleFilterChange}
                onResetFilters={handleResetFilters}
                isCategoriesLoading={isCategoriesLoading}
                activeFilterCount={activeFilterCount}
              />
            </div>

            {/* 2. Main Catalog Column */}
            <main className="lg:col-span-9 flex flex-col space-y-space-md">
              {/* Top Results Toolbar */}
              <div className="bg-surface-container-lowest p-3 px-5 rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-space-sm border border-surface-container/60">
                <div className="flex items-center justify-between w-full sm:w-auto gap-space-sm text-body-sm font-body-sm">
                  <span className="text-on-surface-variant">
                    Showing{" "}
                    <span className="font-semibold text-primary">
                      {startItemIndex}–{endItemIndex}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-primary">{totalCount}</span>{" "}
                    items ·{" "}
                    <span className="text-outline">
                      Page {currentPage} ({PAGE_SIZE} per page)
                    </span>
                  </span>

                  {/* Mobile filter toggle button */}
                  <button
                    type="button"
                    onClick={() => setIsMobileFiltersOpen(true)}
                    className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-variant text-primary font-label-md text-label-md border border-outline-variant/40 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Filters</span>
                    {activeFilterCount > 0 && (
                      <span className="ml-1 w-5 h-5 rounded-full bg-primary text-on-primary text-label-sm font-bold flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Right controls: Sort dropdown */}
                <div className="flex items-center gap-space-md w-full sm:w-auto justify-between sm:justify-end">
                  <div className="flex items-center gap-1.5 text-body-sm font-body-sm">
                    <span className="text-outline hidden md:inline">Sort by:</span>
                    <div className="relative">
                      <select
                        value={sortOption}
                        onChange={(e) => {
                          setSortOption(e.target.value as ApiProductSortOption)
                          setCurrentPage(1)
                        }}
                        className="bg-surface-container-low font-label-md text-label-md text-primary font-semibold py-1.5 pl-3 pr-8 rounded-lg border-0 focus:ring-2 focus:ring-primary/20 cursor-pointer appearance-none"
                      >
                        <option value="newest">Newest First</option>
                        <option value="price_asc">Price: Low to High</option>
                        <option value="price_desc">Price: High to Low</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-outline pointer-events-none absolute right-2 top-2.5" />
                    </div>
                  </div>

                  <div className="flex items-center bg-surface-container-low p-1 rounded-lg gap-1">
                    <div
                      className="p-1.5 rounded bg-surface-container-lowest text-primary shadow-xs"
                      title="Grid View Active"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {/* State 1: Loading Skeleton */}
              {isLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-gutter">
                  {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                    <div
                      key={`skeleton-${i}`}
                      className="bg-surface-container-lowest rounded-xl p-space-md border border-surface-container/60 animate-pulse space-y-3"
                    >
                      <div className="w-full aspect-square bg-surface-container-low rounded-lg" />
                      <div className="h-4 bg-surface-container-low rounded w-1/3" />
                      <div className="h-5 bg-surface-container-low rounded w-5/6" />
                      <div className="h-4 bg-surface-container-low rounded w-1/2" />
                      <div className="h-6 bg-surface-container-low rounded w-2/5 pt-2" />
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div className="h-8 bg-surface-container-low rounded" />
                        <div className="h-8 bg-surface-container-low rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* State 2: Error State */}
              {!isLoading && error && (
                <div className="bg-surface-container-lowest rounded-xl p-space-xl border border-error/20 text-center space-y-3 my-4">
                  <div className="w-12 h-12 rounded-full bg-error-container text-error mx-auto flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    Failed to Load Products
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto">
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors shadow-xs cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              )}

              {/* State 3: Empty State */}
              {!isLoading && !error && products.length === 0 && (
                <div className="bg-surface-container-lowest rounded-xl p-space-xl border border-surface-container/60 text-center space-y-3 my-4">
                  <div className="w-14 h-14 rounded-full bg-surface-container-low text-outline mx-auto flex items-center justify-center">
                    <PackageOpen className="w-7 h-7" />
                  </div>
                  <h3 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                    No Products Found
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto">
                    We couldn't find any products matching your selected filters. Try
                    adjusting your price range, category, or brand selection.
                  </p>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Reset All Filters</span>
                  </button>
                </div>
              )}

              {/* State 4: Normal Product Grid */}
              {!isLoading && !error && products.length > 0 && (
                <>
                  <ProductGrid columns={3} className="xl:grid-cols-4">
                    {products.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onViewDetails={onProductClick}
                        onAddToCart={onAddToCart}
                        onToggleWishlist={onToggleWishlist}
                        isWishlisted={wishlistedProductIds?.has(product.id)}
                      />
                    ))}
                  </ProductGrid>

                  {/* Pagination Navigation */}
                  <div className="pt-space-md">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={(page) => {
                        setCurrentPage(page)
                        window.scrollTo({ top: 0, behavior: "smooth" })
                      }}
                    />
                  </div>
                </>
              )}
            </main>
          </div>
        </section>
      </Container>

      {/* Mobile Filters Slide-over Modal / Drawer */}
      {isMobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity backdrop-blur-xs"
            onClick={() => setIsMobileFiltersOpen(false)}
          />

          {/* Drawer content */}
          <div className="relative ml-auto w-full max-w-xs bg-surface-container-lowest h-full shadow-2xl p-space-md flex flex-col justify-between overflow-y-auto z-10">
            <div>
              <div className="flex items-center justify-between pb-space-sm border-b border-surface-container/60 mb-space-sm">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-primary" />
                  <h3 className="font-headline-sm text-headline-sm text-primary font-bold">
                    Filters
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileFiltersOpen(false)}
                  className="p-1 rounded-lg hover:bg-surface-container-low text-on-surface-variant"
                  aria-label="Close filters"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <FilterSidebar
                key={`${filters.minPrice ?? ""}:${filters.maxPrice ?? ""}`}
                categories={categories}
                availableBrands={availableBrands}
                brandLoadError={brandLoadError}
                filters={filters}
                onFilterChange={handleFilterChange}
                onResetFilters={handleResetFilters}
                isCategoriesLoading={isCategoriesLoading}
                activeFilterCount={activeFilterCount}
                className="border-0 shadow-none p-0"
              />
            </div>

            <div className="pt-space-md border-t border-surface-container/60 mt-space-md">
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(false)}
                className="w-full py-2.5 bg-primary text-on-primary rounded-lg font-label-md text-label-md font-bold shadow-xs cursor-pointer"
              >
                Show Results ({totalCount})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
