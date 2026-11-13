import { useState, useEffect, useRef } from "react"
import { Search, X, ArrowRight } from "lucide-react"
import { getSearchSuggestions } from "@/services/search.service"
import type { SearchSuggestionItem } from "@/mocks/search.mock"
import { cn } from "@/lib/utils"

export interface SearchBarProps {
  initialQuery?: string
  placeholder?: string
  onSearchSubmit: (query: string) => void
  onSuggestionClick?: (suggestion: SearchSuggestionItem) => void
  className?: string
  autoFocus?: boolean
  compact?: boolean
}

export function SearchBar({
  initialQuery = "",
  placeholder = "Search verified catalog by keyword, model, or SKU...",
  onSearchSubmit,
  onSuggestionClick,
  className,
  autoFocus = false,
  compact = false,
}: SearchBarProps) {
  const [query, setQuery] = useState(initialQuery)
  const [prevInitialQuery, setPrevInitialQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<SearchSuggestionItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1)
  const containerRef = useRef<HTMLDivElement>(null)

  // Sync external initialQuery if updated during navigation
  if (initialQuery !== prevInitialQuery) {
    setPrevInitialQuery(initialQuery)
    setQuery(initialQuery)
  }

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Debounced suggestion query
  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed || trimmed.length < 2) {
      return
    }

    let isCancelled = false

    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const results = await getSearchSuggestions(trimmed)
        if (!isCancelled) {
          setSuggestions(results)
          setIsOpen(true)
          setHighlightedIndex(-1)
        }
      } catch {
        if (!isCancelled) {
          setSuggestions([])
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }, 200)

    return () => {
      isCancelled = true
      clearTimeout(timer)
    }
  }, [query])

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      setIsOpen(false)
      setHighlightedIndex(-1)
      onSearchSubmit(trimmed)
    }
  }

  const handleClear = () => {
    setQuery("")
    setSuggestions([])
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleSelectSuggestion = (item: SearchSuggestionItem) => {
    setIsOpen(false)
    setHighlightedIndex(-1)
    if (onSuggestionClick) {
      onSuggestionClick(item)
    } else {
      setQuery(item.title)
      onSearchSubmit(item.title)
    }
  }

  // Arrow key navigation through suggestions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "Enter") {
        handleSubmit()
      }
      return
    }

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelectSuggestion(suggestions[highlightedIndex])
      } else {
        handleSubmit()
      }
    } else if (e.key === "Escape") {
      e.preventDefault()
      setIsOpen(false)
      setHighlightedIndex(-1)
    }
  }

  const productMatches = suggestions.filter((s) => s.type === "product")
  const categoryMatches = suggestions.filter((s) => s.type === "category")
  const brandMatches = suggestions.filter((s) => s.type === "brand")

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form
        onSubmit={handleSubmit}
        className={cn(
          "relative flex items-center w-full bg-surface-container-low transition-colors border border-transparent focus-within:border-outline-variant",
          compact
            ? "rounded-full px-space-xs py-1"
            : "rounded-2xl p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-primary"
        )}
      >
        <div className={cn("flex items-center text-on-surface-variant", compact ? "pl-3" : "pl-space-md")}>
          <Search className={cn("text-primary", compact ? "w-4 h-4" : "w-5 h-5")} />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-label={placeholder}
          aria-expanded={isOpen}
          aria-autocomplete="list"
          role="combobox"
          placeholder={placeholder}
          className={cn(
            "w-full bg-transparent text-on-surface placeholder:text-outline focus:outline-none",
            compact ? "py-1.5 px-space-sm font-body-sm text-body-sm" : "py-space-sm px-space-md font-body-md text-body-md"
          )}
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear query text"
            className="p-1 text-outline hover:text-on-surface transition-colors rounded-full hover:bg-surface-container flex items-center justify-center mr-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        <button
          type="submit"
          aria-label="Submit search"
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-xl bg-secondary-container text-on-secondary hover:bg-secondary transition-all font-label-md text-label-md font-bold shadow-xs cursor-pointer shrink-0",
            compact ? "h-8 px-3 rounded-full" : "h-10 px-space-md sm:px-space-lg"
          )}
        >
          <span>Search</span>
          {!compact && <ArrowRight className="w-4 h-4 hidden sm:inline" />}
        </button>
      </form>

      {/* Intelligent Autocomplete Dropdown Popover */}
      {isOpen && query.trim().length >= 2 && (
        <div
          role="listbox"
          aria-label="Search suggestions"
          className="absolute top-[calc(100%+8px)] left-0 w-full z-50 bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container/60 overflow-hidden transition-all animate-fadeIn"
        >
          {/* Header */}
          <div className="p-space-sm sm:p-space-md bg-surface-container-low/70 flex items-center justify-between border-b border-surface-container/60">
            <div className="flex items-center gap-space-xs text-primary font-label-md text-label-md font-bold">
              <Search className="w-4 h-4 text-secondary-container" />
              <span>Search Suggestions</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false)
                setHighlightedIndex(-1)
              }}
              className="text-outline hover:text-on-surface text-label-sm font-label-sm cursor-pointer"
            >
              Close
            </button>
          </div>

          {isLoading ? (
            <div className="p-6 text-center text-outline font-body-sm text-body-sm animate-pulse">
              Finding suggestions...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="p-6 text-center text-outline font-body-sm text-body-sm">
              No direct suggestions found for "{query}". Press Enter to search catalog.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 p-space-md gap-space-md max-h-96 overflow-y-auto">
              {/* Left Column: Direct Product Matches (7 cols) */}
              <div className="md:col-span-7 flex flex-col gap-space-xs">
                <span className="font-label-sm text-label-sm text-outline tracking-wider uppercase font-bold mb-1">
                  Direct Product Matches
                </span>
                {productMatches.length === 0 ? (
                  <p className="text-outline text-label-sm">No specific product matches</p>
                ) : (
                  productMatches.map((item) => {
                    const itemGlobalIdx = suggestions.findIndex((s) => s.id === item.id)
                    const isHighlighted = itemGlobalIdx === highlightedIndex

                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        aria-selected={isHighlighted}
                        onClick={() => handleSelectSuggestion(item)}
                        className={cn(
                          "flex items-center gap-space-md p-2 rounded-xl transition-colors text-left group cursor-pointer w-full border border-transparent",
                          isHighlighted
                            ? "bg-primary-fixed/40 border-primary"
                            : "hover:bg-surface-container-low"
                        )}
                      >
                        {item.imageUrl && (
                          <div className="w-12 h-12 rounded-lg bg-surface-container flex-shrink-0 flex items-center justify-center overflow-hidden">
                            <img
                              src={item.imageUrl}
                              alt=""
                              className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
                            />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-title-md text-title-md text-on-surface truncate group-hover:text-primary transition-colors font-medium">
                            {item.title}
                          </h4>
                          <div className="flex items-center gap-2 text-body-sm font-body-sm text-on-surface-variant">
                            {item.price !== undefined && (
                              <span className="text-secondary-container font-semibold">
                                ₹{item.price.toLocaleString("en-IN")}
                              </span>
                            )}
                            {item.sku && (
                              <>
                                <span className="text-outline">·</span>
                                <span className="text-outline">SKU: {item.sku}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>

              {/* Right Column: Categories & Brands (5 cols) */}
              <div className="md:col-span-5 flex flex-col gap-space-md border-t md:border-t-0 md:border-l border-surface-container/60 pt-space-sm md:pt-0 md:pl-space-md">
                {/* Categories */}
                {categoryMatches.length > 0 && (
                  <div>
                    <span className="font-label-sm text-label-sm text-outline tracking-wider uppercase font-bold">
                      Categories
                    </span>
                    <div className="mt-1.5 space-y-1">
                      {categoryMatches.map((cat) => {
                        const itemGlobalIdx = suggestions.findIndex((s) => s.id === cat.id)
                        const isHighlighted = itemGlobalIdx === highlightedIndex

                        return (
                          <button
                            key={cat.id}
                            type="button"
                            role="option"
                            aria-selected={isHighlighted}
                            onClick={() => handleSelectSuggestion(cat)}
                            className={cn(
                              "block w-full text-left p-1.5 rounded-lg text-on-surface transition-colors cursor-pointer border border-transparent",
                              isHighlighted
                                ? "bg-primary-fixed/40 border-primary text-primary"
                                : "hover:bg-surface-container-low hover:text-primary"
                            )}
                          >
                            <div className="font-body-md text-body-md font-medium truncate">
                              {cat.title}
                            </div>
                            {cat.subtitle && (
                              <div className="font-body-sm text-body-sm text-outline truncate">
                                {cat.subtitle}
                              </div>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Brands */}
                {brandMatches.length > 0 && (
                  <div>
                    <span className="font-label-sm text-label-sm text-outline tracking-wider uppercase font-bold">
                      Brands
                    </span>
                    <div className="mt-1.5 space-y-1">
                      {brandMatches.map((b) => {
                        const itemGlobalIdx = suggestions.findIndex((s) => s.id === b.id)
                        const isHighlighted = itemGlobalIdx === highlightedIndex

                        return (
                          <button
                            key={b.id}
                            type="button"
                            role="option"
                            aria-selected={isHighlighted}
                            onClick={() => handleSelectSuggestion(b)}
                            className={cn(
                              "flex items-center justify-between w-full text-left p-1.5 rounded-lg text-on-surface transition-colors cursor-pointer border border-transparent",
                              isHighlighted
                                ? "bg-primary-fixed/40 border-primary text-primary"
                                : "hover:bg-surface-container-low hover:text-primary"
                            )}
                          >
                            <span className="font-body-md text-body-md font-medium">
                              {b.title}
                            </span>
                            <span className="text-outline text-label-sm font-label-sm">
                              Brand
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
