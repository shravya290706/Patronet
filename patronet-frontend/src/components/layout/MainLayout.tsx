import type { ReactNode } from "react"
import { Header } from "./Header"
import { Footer } from "./Footer"
import { AppSidebar } from "./AppSidebar"
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
  activeView?: string
  onNavigateHome?: () => void
  onNavigateProducts?: () => void
  onNavigateSearch?: () => void
  onNavigateCart?: () => void
  onNavigateWishlist?: () => void
  onNavigateOrders?: () => void
  onNavigateAddresses?: () => void
  onNavigateCheckout?: () => void
  onNavigateLogin?: () => void
  onNavigateRegister?: () => void
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
  activeView,
  onNavigateHome,
  onNavigateProducts,
  onNavigateSearch,
  onNavigateCart,
  onNavigateWishlist,
  onNavigateOrders,
  onNavigateAddresses,
  onNavigateCheckout,
  onNavigateLogin,
  onNavigateRegister,
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

      {/* Persistent Body: Sidebar on the left + Main Page Content on the right */}
      <div className="flex-1 flex flex-row min-h-0 w-full relative">
        <AppSidebar
          activeView={activeView}
          onNavigateHome={onNavigateHome}
          onNavigateProducts={onNavigateProducts}
          onNavigateSearch={onNavigateSearch}
          onNavigateCart={onNavigateCart}
          onNavigateWishlist={onNavigateWishlist}
          onNavigateOrders={onNavigateOrders}
          onNavigateAddresses={onNavigateAddresses}
          onNavigateCheckout={onNavigateCheckout}
          onNavigateLogin={onNavigateLogin}
          onNavigateRegister={onNavigateRegister}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          isAuthenticated={isAuthenticated}
          customerName={customerName}
          onLogout={onLogout}
        />

        <main className={cn("flex-1 min-w-0 flex flex-col", className)}>
          {children}
        </main>
      </div>

      {/* Shared Marketplace Footer */}
      <Footer />
    </div>
  )
}
