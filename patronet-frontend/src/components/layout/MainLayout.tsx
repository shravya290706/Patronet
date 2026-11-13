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
}

export function MainLayout({
  children,
  className,
  currentLocation,
  onSearchSubmit,
  onSuggestionClick,
  onCategorySelect,
}: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface antialiased selection:bg-primary-fixed selection:text-on-primary-fixed">
      {/* Sticky Two-tier Header with Unified SearchBar */}
      <Header
        currentLocation={currentLocation}
        onSearchSubmit={onSearchSubmit}
        onSuggestionClick={onSuggestionClick}
        onCategorySelect={onCategorySelect}
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
