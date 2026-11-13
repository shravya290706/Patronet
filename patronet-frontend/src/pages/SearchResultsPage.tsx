import { useState, useEffect } from "react"
import {
  Search,
  AlertCircle,
  PackageOpen,
  RotateCcw,
  Sparkles,
} from "lucide-react"

import { Container } from "@/components/layout"
import { Breadcrumbs, type BreadcrumbItem, Pagination } from "@/components/ui"
import { ProductCard, ProductGrid } from "@/components/products"
import { SearchBar } from "@/components/search"
import { searchProducts } from "@/services/search.service"
import type { UiProductCardModel } from "@/types/ui.types"
import type { SearchSuggestionItem } from "@/mocks/search.mock"

export interface SearchResultsPageProps {
  initialQuery?: string
  onProductClick?: (id: string) => void
  onAddToCart?: (id: string) => void
  onNavigateHome?: () => void
  onSearchSubmit?: (newQuery: string) => void
  onCategoryClick?: (categoryId?: string) => void
}

const PAGE_SIZE = 12

export function SearchResultsPage({
  initialQuery = "",
  onProductClick,
  onAddToCart,
  onNavigateHome,
  onSearchSubmit,
  onCategoryClick,
}: SearchResultsPageProps) {
  const [activeQuery, setActiveQuery] = useState(initialQuery)
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery)
  const [currentPage, setCurrentPage] = useState(1)
  const [products, setProducts] = useState<UiProductCardModel[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  // Sync external initialQuery if updated during hash navigation
  if (initialQuery !== prevInitialQuery) {
    setPrevInitialQuery(initialQuery)
    setActiveQuery(initialQuery)
    setCurrentPage(1)
  }

  // Execute search through search service
  useEffect(() => {
    let isCancelled = false

    async function executeSearch() {
      const trimmed = activeQuery.trim()
      if (!trimmed) {
        setProducts([])
        setTotalCount(0)
        setTotalPages(1)
        setIsLoading(false)
        setError(null)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const response = await searchProducts({
          query: trimmed,
          page: currentPage,
          pageSize: PAGE_SIZE,
        })

        if (!isCancelled) {
          setProducts(response.items)
          setTotalCount(response.total)
          setTotalPages(response.totalPages)
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setProducts([])
          setTotalCount(0)
          setTotalPages(1)
          setError(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred while executing the search."
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    executeSearch()

    return () => {
      isCancelled = true
    }
  }, [activeQuery, currentPage, reloadKey])

  const handleQuerySubmit = (newQuery: string) => {
    setActiveQuery(newQuery)
    setCurrentPage(1)
    if (onSearchSubmit) {
      onSearchSubmit(newQuery)
    }
  }

  const handleSuggestionClick = (suggestion: SearchSuggestionItem) => {
    if (suggestion.type === "product" && suggestion.targetId && onProductClick) {
      onProductClick(suggestion.targetId)
    } else if (suggestion.type === "category" && onCategoryClick) {
      onCategoryClick(suggestion.targetId)
    } else {
      handleQuerySubmit(suggestion.title)
    }
  }

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Home", href: "#", onClick: onNavigateHome },
    { label: "Search", href: "#search", onClick: () => handleQuerySubmit("") },
    ...(activeQuery ? [{ label: `"${activeQuery}"` }] : []),
  ]

  const startItemIndex = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const endItemIndex = Math.min(currentPage * PAGE_SIZE, totalCount)

  return (
    <div className="bg-surface min-h-[calc(100vh-120px)] py-space-sm pb-space-xl">
      <Container>
        {/* Breadcrumb row */}
        <section className="pt-space-md pb-space-sm">
          <Breadcrumbs items={breadcrumbItems} className="mb-space-md" />
        </section>

        {/* Dedicated Search Header Bar Anchor (Matching Stitch Screen 49d53b25...) */}
        <section className="bg-surface-container-lowest rounded-2xl p-space-md sm:p-space-lg shadow-sm border border-surface-container/60 mb-space-lg">
          <div className="max-w-3xl mx-auto space-y-space-xs text-center mb-space-sm">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-primary font-label-sm text-label-sm uppercase tracking-wider font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Catalog Search</span>
            </span>
            <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight font-bold">
              {activeQuery ? `Results for "${activeQuery}"` : "Search Marketplace"}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Search authentic tech accessories, audio gear, wearables and computing products
            </p>
          </div>

          <div className="max-w-2xl mx-auto">
            <SearchBar
              initialQuery={activeQuery}
              onSearchSubmit={handleQuerySubmit}
              onSuggestionClick={handleSuggestionClick}
            />
          </div>
        </section>

        {/* STATE 1: Empty Query / Initial Prompt */}
        {!activeQuery.trim() && (
          <div className="bg-surface-container-lowest rounded-2xl p-space-xl border border-surface-container/60 text-center space-y-3 my-8 max-w-xl mx-auto shadow-sm">
            <div className="w-14 h-14 rounded-full bg-surface-container-low text-primary mx-auto flex items-center justify-center">
              <Search className="w-7 h-7" />
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Enter a Search Term
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Type product names, brands (e.g. SonicWave, Chronos Tech), or categories to browse results.
            </p>
          </div>
        )}

        {/* STATE 2: Loading Skeleton */}
        {isLoading && (
          <div className="space-y-space-md">
            <div className="h-10 bg-surface-container-low rounded-xl w-1/4 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-gutter animate-pulse">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={`search-skel-${i}`}
                  className="bg-surface-container-lowest rounded-xl p-space-md border border-surface-container/60 space-y-3"
                >
                  <div className="w-full aspect-square bg-surface-container-low rounded-lg" />
                  <div className="h-4 bg-surface-container-low rounded w-1/3" />
                  <div className="h-5 bg-surface-container-low rounded w-5/6" />
                  <div className="h-4 bg-surface-container-low rounded w-1/2" />
                  <div className="h-6 bg-surface-container-low rounded w-2/5 pt-2" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STATE 3: Error State */}
        {!isLoading && error && (
          <div className="bg-surface-container-lowest rounded-2xl p-space-xl border border-error/20 text-center space-y-3 my-8 max-w-xl mx-auto shadow-sm">
            <div className="w-12 h-12 rounded-full bg-error-container text-error mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Search Failed
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {error}
            </p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry Search</span>
            </button>
          </div>
        )}

        {/* STATE 4: Empty Results State */}
        {!isLoading && !error && activeQuery.trim() && products.length === 0 && (
          <div className="bg-surface-container-lowest rounded-2xl p-space-xl border border-surface-container/60 text-center space-y-3 my-8 max-w-xl mx-auto shadow-sm">
            <div className="w-14 h-14 rounded-full bg-surface-container-low text-outline mx-auto flex items-center justify-center">
              <PackageOpen className="w-7 h-7" />
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              No Results Found for "{activeQuery}"
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-md mx-auto">
              We couldn't find any items matching your query. Try checking your spelling or searching for a broader term like "audio", "wireless", or "keyboard".
            </p>
            <button
              type="button"
              onClick={() => handleQuerySubmit("")}
              className="px-4 py-2 bg-surface-container-low text-on-surface hover:bg-surface-variant rounded-lg font-label-md text-label-md transition-colors cursor-pointer inline-flex items-center gap-1.5 mt-2"
            >
              <span>Clear Search</span>
            </button>
          </div>
        )}

        {/* STATE 5: Results Grid Display */}
        {!isLoading && !error && products.length > 0 && (
          <div className="space-y-space-md">
            {/* Toolbar Summary */}
            <div className="bg-surface-container-lowest p-3 px-5 rounded-xl shadow-sm border border-surface-container/60 flex items-center justify-between">
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                Showing{" "}
                <span className="font-semibold text-primary">
                  {startItemIndex}–{endItemIndex}
                </span>{" "}
                of <span className="font-semibold text-primary">{totalCount}</span> items matching{" "}
                <span className="font-semibold text-primary">"{activeQuery}"</span>
              </span>
            </div>

            {/* Results Grid */}
            <ProductGrid columns={4}>
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onViewDetails={onProductClick}
                  onAddToCart={onAddToCart}
                />
              ))}
            </ProductGrid>

            {/* Pagination if multiple pages */}
            {totalPages > 1 && (
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
            )}
          </div>
        )}
      </Container>
    </div>
  )
}
