import { useState } from "react"
import { Heart, ShoppingBag, User, ChevronDown, Menu, X } from "lucide-react"
import { Container } from "./Container"
import { Navigation } from "./Navigation"
import { SearchBar } from "@/components/search"
import type { SearchSuggestionItem } from "@/mocks/search.mock"
import patronetLogo from "@/assets/brand/patronet-logo-cropped.png"
import { cn } from "@/lib/utils"

interface HeaderProps {
  onSearchSubmit?: (query: string) => void
  onSuggestionClick?: (suggestion: SearchSuggestionItem) => void
  onCategorySelect?: (categoryId: string) => void
  currentLocation?: string
  className?: string
}

export function Header({
  onSearchSubmit,
  onSuggestionClick,
  onCategorySelect,
  currentLocation,
  className,
}: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleSearchSubmit = (query: string) => {
    if (onSearchSubmit) {
      onSearchSubmit(query.trim())
    }
  }

  return (
    <header
      className={cn(
        "sticky top-0 left-0 w-full z-50 bg-surface-container-lowest shadow-header",
        className
      )}
    >
      {/* Upper Main Header Bar: 80px (h-20) */}
      <Container className="h-20 flex items-center justify-between gap-space-md sm:gap-gutter">
        {/* Brand / Logo Area */}
        <div className="flex items-center gap-space-sm flex-shrink-0">
          <button
            type="button"
            className="md:hidden p-1.5 -ml-1 text-on-surface-variant hover:text-on-surface rounded-lg cursor-pointer"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          <a
            href="#"
            className="flex items-center group rounded-xl bg-[#042373] px-3 py-1.5 sm:px-3.5 sm:py-2 shadow-xs hover:bg-[#243b8a] transition-colors"
            aria-label="PATRONET Home"
          >
            <img
              src={patronetLogo}
              alt="PATRONET - Unified Retail Marketplace"
              className="h-8 sm:h-9 md:h-10 w-auto max-w-[140px] sm:max-w-[170px] md:max-w-[215px] object-contain"
            />
          </a>
        </div>

        {/* Desktop Search Bar (Unified SearchBar component with autocomplete & keyboard navigation) */}
        <div className="flex-1 max-w-2xl hidden md:flex items-center">
          <SearchBar
            compact
            placeholder="Search over 1,000,000 products, brands and categories..."
            onSearchSubmit={handleSearchSubmit}
            onSuggestionClick={onSuggestionClick}
          />
        </div>

        {/* Right User Actions Area */}
        <div className="flex items-center gap-space-xs sm:gap-space-sm md:gap-space-md flex-shrink-0">
          {/* Wishlist Link/Trigger */}
          <a
            href="#wishlist"
            aria-label="Wishlist"
            className="relative p-2 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors rounded-full"
          >
            <Heart className="h-5 w-5" />
          </a>

          {/* Cart Link/Trigger */}
          <a
            href="#cart"
            aria-label="Shopping Cart"
            className="relative p-2 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors rounded-full"
          >
            <ShoppingBag className="h-5 w-5" />
          </a>

          {/* Account Profile Entry */}
          <a
            href="#login"
            className="flex items-center gap-1 cursor-pointer pl-space-xs text-on-surface-variant hover:text-on-surface select-none group"
            aria-label="User Account"
          >
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center text-outline group-hover:text-primary transition-colors overflow-hidden">
                <User className="h-4 w-4" />
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-secondary-container ring-1 ring-surface-container-lowest" />
            </div>
            <ChevronDown className="h-4 w-4 text-outline group-hover:text-on-surface transition-colors hidden sm:inline" />
          </a>
        </div>
      </Container>

      {/* Mobile Inline Search Bar (Visible on mobile viewports below header) */}
      <div className="md:hidden border-t border-surface-container bg-surface-container-lowest px-gutter py-2">
        <SearchBar
          compact
          placeholder="Search products..."
          onSearchSubmit={handleSearchSubmit}
          onSuggestionClick={onSuggestionClick}
        />
      </div>

      {/* Lower Secondary Category Bar (Sub-Nav) */}
      <Navigation
        currentLocation={currentLocation}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        onCategorySelect={onCategorySelect}
      />
    </header>
  )
}
