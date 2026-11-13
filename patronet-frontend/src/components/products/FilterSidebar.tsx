import { useState, useMemo } from "react"
import { Filter, X, RotateCcw, Search } from "lucide-react"
import type { UiCategoryModel } from "@/types/ui.types"
import { cn } from "@/lib/utils"

export interface FilterState {
  categoryId?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
}

interface FilterSidebarProps {
  categories: UiCategoryModel[]
  availableBrands: string[]
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
  onResetFilters: () => void
  isCategoriesLoading?: boolean
  className?: string
  activeFilterCount?: number
}

export function FilterSidebar({
  categories,
  availableBrands,
  filters,
  onFilterChange,
  onResetFilters,
  isCategoriesLoading = false,
  className,
  activeFilterCount = 0,
}: FilterSidebarProps) {
  // Local state for price inputs before applying
  const [minInput, setMinInput] = useState<string>(
    filters.minPrice !== undefined ? String(filters.minPrice) : ""
  )
  const [maxInput, setMaxInput] = useState<string>(
    filters.maxPrice !== undefined ? String(filters.maxPrice) : ""
  )
  const [priceError, setPriceError] = useState<string | null>(null)

  // Local state for brand search input
  const [brandSearch, setBrandSearch] = useState("")

  // Filtered brand list based on search
  const displayedBrands = useMemo(() => {
    if (!brandSearch.trim()) return availableBrands
    const q = brandSearch.toLowerCase()
    return availableBrands.filter((b) => b.toLowerCase().includes(q))
  }, [availableBrands, brandSearch])

  // Category change handler
  const handleCategorySelect = (catId?: string) => {
    onFilterChange({
      ...filters,
      categoryId: catId,
    })
  }

  // Brand toggle handler (single brand parameter per backend spec)
  const handleBrandToggle = (brandName: string) => {
    onFilterChange({
      ...filters,
      brand: filters.brand === brandName ? undefined : brandName,
    })
  }

  // Price validation and submit
  const handleApplyPrice = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setPriceError(null)

    const parsedMin = minInput.trim() !== "" ? Number(minInput) : undefined
    const parsedMax = maxInput.trim() !== "" ? Number(maxInput) : undefined

    if (parsedMin !== undefined && (isNaN(parsedMin) || parsedMin < 0)) {
      setPriceError("Min price must be a positive number")
      return
    }

    if (parsedMax !== undefined && (isNaN(parsedMax) || parsedMax < 0)) {
      setPriceError("Max price must be a positive number")
      return
    }

    if (
      parsedMin !== undefined &&
      parsedMax !== undefined &&
      parsedMin > parsedMax
    ) {
      setPriceError("Min price cannot exceed Max price")
      return
    }

    onFilterChange({
      ...filters,
      minPrice: parsedMin,
      maxPrice: parsedMax,
    })
  }

  const handleResetPrice = () => {
    setMinInput("")
    setMaxInput("")
    setPriceError(null)
    onFilterChange({
      ...filters,
      minPrice: undefined,
      maxPrice: undefined,
    })
  }

  return (
    <aside
      className={cn(
        "space-y-space-md bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container/60",
        className
      )}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between pb-space-xs border-b border-surface-container/60">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-primary" />
          <h2 className="font-headline-sm text-headline-sm text-primary font-bold">
            Filters
          </h2>
        </div>
        {activeFilterCount > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-surface-container-low font-label-sm text-label-sm text-outline font-medium">
            {activeFilterCount} Active
          </span>
        )}
      </div>

      {/* 1. Category Filter (category_id) */}
      <div className="space-y-space-xs pt-space-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider font-bold">
            Categories
          </h3>
          {filters.categoryId && (
            <button
              type="button"
              onClick={() => handleCategorySelect(undefined)}
              className="font-label-sm text-label-sm text-primary font-semibold hover:underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        {isCategoriesLoading ? (
          <div className="space-y-2 py-2 animate-pulse">
            <div className="h-7 bg-surface-container-low rounded-lg w-full" />
            <div className="h-7 bg-surface-container-low rounded-lg w-3/4" />
            <div className="h-7 bg-surface-container-low rounded-lg w-5/6" />
          </div>
        ) : (
          <div className="space-y-1 font-body-sm text-body-sm text-on-surface-variant max-h-56 overflow-y-auto pr-1">
            <label
              className={cn(
                "flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-colors",
                !filters.categoryId
                  ? "bg-primary-fixed/40 text-primary font-semibold"
                  : "hover:bg-surface-container-low"
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="category_filter"
                  checked={!filters.categoryId}
                  onChange={() => handleCategorySelect(undefined)}
                  className="text-primary focus:ring-0 rounded-full cursor-pointer"
                />
                <span>All Categories</span>
              </span>
            </label>

            {categories.map((cat) => {
              const isSelected = filters.categoryId === cat.id
              return (
                <label
                  key={cat.id}
                  className={cn(
                    "flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-colors",
                    isSelected
                      ? "bg-primary-fixed/40 text-primary font-semibold"
                      : "hover:bg-surface-container-low"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="category_filter"
                      checked={isSelected}
                      onChange={() => handleCategorySelect(cat.id)}
                      className="text-primary focus:ring-0 rounded-full cursor-pointer"
                    />
                    <span className="truncate">{cat.name}</span>
                  </span>
                </label>
              )
            })}
          </div>
        )}
      </div>

      <div className="h-px bg-surface-container/80" />

      {/* 2. Price Range Filter (min_price, max_price) */}
      <form onSubmit={handleApplyPrice} className="space-y-space-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider font-bold">
            Price Range (₹)
          </h3>
          {(filters.minPrice !== undefined || filters.maxPrice !== undefined) && (
            <button
              type="button"
              onClick={handleResetPrice}
              className="font-label-sm text-label-sm text-primary font-semibold hover:underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <span className="font-label-sm text-label-sm text-outline block mb-0.5">
              Min Price
            </span>
            <div className="flex items-center bg-surface-container-low rounded-lg px-2 py-1.5 border border-outline-variant/30 focus-within:border-primary">
              <span className="text-on-surface-variant font-label-md text-label-md mr-1 select-none">
                ₹
              </span>
              <input
                type="number"
                min="0"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                placeholder="0"
                className="w-full bg-transparent font-body-sm text-body-sm text-on-surface focus:outline-none p-0 border-0"
              />
            </div>
          </div>
          <div>
            <span className="font-label-sm text-label-sm text-outline block mb-0.5">
              Max Price
            </span>
            <div className="flex items-center bg-surface-container-low rounded-lg px-2 py-1.5 border border-outline-variant/30 focus-within:border-primary">
              <span className="text-on-surface-variant font-label-md text-label-md mr-1 select-none">
                ₹
              </span>
              <input
                type="number"
                min="0"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                placeholder="50000"
                className="w-full bg-transparent font-body-sm text-body-sm text-on-surface focus:outline-none p-0 border-0"
              />
            </div>
          </div>
        </div>

        {priceError && (
          <p className="font-label-sm text-label-sm text-error mt-1">
            {priceError}
          </p>
        )}

        <button
          type="submit"
          className="w-full mt-2 py-1.5 px-3 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors shadow-xs font-semibold cursor-pointer"
        >
          Apply Price
        </button>
      </form>

      <div className="h-px bg-surface-container/80" />

      {/* 3. Brand Filter (brand) */}
      <div className="space-y-space-xs">
        <div className="flex items-center justify-between">
          <h3 className="font-label-md text-label-md text-on-surface uppercase tracking-wider font-bold">
            Brand
          </h3>
          {filters.brand && (
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, brand: undefined })}
              className="font-label-sm text-label-sm text-primary font-semibold hover:underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>

        {/* Brand search filter */}
        <div className="relative flex items-center bg-surface-container-low rounded-lg px-2 py-1.5 border border-outline-variant/30">
          <Search className="w-4 h-4 text-outline mr-1.5 shrink-0" />
          <input
            type="text"
            value={brandSearch}
            onChange={(e) => setBrandSearch(e.target.value)}
            placeholder="Filter brands..."
            className="w-full bg-transparent font-body-sm text-body-sm text-on-surface placeholder:text-outline focus:outline-none p-0 border-0"
          />
          {brandSearch && (
            <button
              type="button"
              onClick={() => setBrandSearch("")}
              className="text-outline hover:text-on-surface p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Brand list */}
        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 font-body-sm text-body-sm text-on-surface-variant">
          {displayedBrands.length === 0 ? (
            <p className="text-outline text-label-sm py-2 text-center">
              No matching brands
            </p>
          ) : (
            displayedBrands.map((brandName) => {
              const isChecked = filters.brand === brandName
              return (
                <label
                  key={brandName}
                  className="flex items-center justify-between cursor-pointer hover:text-on-surface p-1 rounded hover:bg-surface-container-low transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleBrandToggle(brandName)}
                      className="rounded text-primary focus:ring-0 cursor-pointer"
                    />
                    <span>{brandName}</span>
                  </span>
                </label>
              )
            })
          )}
        </div>
      </div>

      {/* Global Reset Action */}
      {activeFilterCount > 0 && (
        <div className="pt-2 border-t border-surface-container/60">
          <button
            type="button"
            onClick={() => {
              setMinInput("")
              setMaxInput("")
              setPriceError(null)
              setBrandSearch("")
              onResetFilters()
            }}
            className="w-full py-1.5 px-3 border border-outline-variant text-outline hover:text-on-surface hover:bg-surface-container-low rounded-lg font-label-md text-label-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset All Filters</span>
          </button>
        </div>
      )}
    </aside>
  )
}
