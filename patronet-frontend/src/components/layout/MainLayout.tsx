import type { ReactNode } from "react"
import { Header } from "./Header"
import { Footer } from "./Footer"
import type { SearchSuggestionItem } from "@/mocks/search.mock"
import { cn } from "@/lib/utils"

interface MainLayoutProps {
  children: ReactNode
  className?: string
  currentLocation?: string
  onSearchSubmit?: (query: string) => void
  onSuggestionClick?: (suggestion: SearchSuggestionItem) => void
  onCategorySelect?: (categoryId: string) => void
  onLocationClick?: () => void
  isAuthenticated?: boolean
  customerName?: string
  cartCount?: number
  wishlistCount?: number
  onLogout?: () => void
}

export function MainLayout({
  children,
  className,
  currentLocation,
  onSearchSubmit,
  onSuggestionClick,
  onCategorySelect,
  onLocationClick,
  isAuthenticated,
  customerName,
  cartCount,
  wishlistCount,
  onLogout,
}: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface antialiased selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Sticky Two-tier Header with Unified SearchBar */}
      <Header
        currentLocation={currentLocation}
        onSearchSubmit={onSearchSubmit}
        onSuggestionClick={onSuggestionClick}
        onCategorySelect={onCategorySelect}
        onLocationClick={onLocationClick}
        isAuthenticated={isAuthenticated}
        customerName={customerName}
        cartCount={cartCount}
        wishlistCount={wishlistCount}
        onLogout={onLogout}
      />

      {/* Main Content Area */}
      <main className={cn("flex-1", className)}>
        {children}
      </main>

      {/* Shared Marketplace Footer */}
      <Footer />
    </div>
  )
}
