import { useState, useEffect } from "react"
import { MainLayout, BrandIntro } from "@/components/layout"
import { HomePage } from "@/pages/HomePage"
import { ProductListingPage } from "@/pages/ProductListingPage"
import { ProductDetailsPage } from "@/pages/ProductDetailsPage"
import { SearchResultsPage } from "@/pages/SearchResultsPage"
import { LoginPage, RegisterPage, ForgotPasswordPage } from "@/pages"
import type { SearchSuggestionItem } from "@/mocks/search.mock"

type ViewMode = "home" | "products" | "product-details" | "search" | "login" | "register" | "forgot-password"

interface RouteState {
  view: ViewMode
  param?: string
}

function parseHash(): RouteState {
  const hash = window.location.hash
  if (hash === "#login") {
    return { view: "login" }
  }
  if (hash === "#register") {
    return { view: "register" }
  }
  if (hash === "#forgot-password") {
    return { view: "forgot-password" }
  }
  if (hash.startsWith("#search/")) {
    const rawQuery = hash.replace("#search/", "").trim()
    const query = decodeURIComponent(rawQuery)
    return { view: "search", param: query }
  }
  if (hash.startsWith("#search")) {
    return { view: "search", param: "" }
  }
  if (hash.startsWith("#product/")) {
    const productId = hash.replace("#product/", "").trim()
    return { view: "product-details", param: productId }
  }
  if (hash.startsWith("#products")) {
    const params = new URLSearchParams(hash.replace("#products", "").replace(/^\?/, ""))
    const categoryId = params.get("category") || undefined
    return { view: "products", param: categoryId }
  }
  return { view: "home" }
}

function App() {
  const [routeState, setRouteState] = useState<RouteState>(() => parseHash())
  const [showBrandIntro, setShowBrandIntro] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("patronet_brand_intro_shown") !== "true"
    } catch {
      return false
    }
  })

  const handleIntroComplete = () => {
    setShowBrandIntro(false)
  }

  useEffect(() => {
    const handleHashChange = () => {
      setRouteState(parseHash())
    }

    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])

  const navigateToHome = () => {
    window.location.hash = ""
    setRouteState({ view: "home" })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const navigateToProducts = (categoryId?: string) => {
    const newHash = categoryId ? `#products?category=${categoryId}` : "#products"
    window.location.hash = newHash
    setRouteState({ view: "products", param: categoryId })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const navigateToProductDetails = (productId: string) => {
    window.location.hash = `#product/${productId}`
    setRouteState({ view: "product-details", param: productId })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const navigateToSearch = (query: string) => {
    const encoded = encodeURIComponent(query.trim())
    window.location.hash = encoded ? `#search/${encoded}` : "#search"
    setRouteState({ view: "search", param: query.trim() })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const navigateToLogin = () => {
    window.location.hash = "#login"
    setRouteState({ view: "login" })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const navigateToRegister = () => {
    window.location.hash = "#register"
    setRouteState({ view: "register" })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const navigateToForgotPassword = () => {
    window.location.hash = "#forgot-password"
    setRouteState({ view: "forgot-password" })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleSuggestionSelect = (suggestion: SearchSuggestionItem) => {
    if (suggestion.type === "product" && suggestion.targetId) {
      navigateToProductDetails(suggestion.targetId)
    } else if (suggestion.type === "category" && suggestion.targetId) {
      navigateToProducts(suggestion.targetId)
    } else {
      navigateToSearch(suggestion.title)
    }
  }

  return (
    <>
      {showBrandIntro && (
        <BrandIntro onComplete={handleIntroComplete} />
      )}

      <MainLayout
        onSearchSubmit={navigateToSearch}
        onSuggestionClick={handleSuggestionSelect}
        onCategorySelect={(catId) => navigateToProducts(catId)}
      >
      {/* Top Demo Bar for Testing All Navigation States (Dev Only) */}
      {import.meta.env.DEV && (
        <div className="bg-primary-container/10 border-b border-primary/10 py-1.5 px-4 text-center">
          <div className="inline-flex items-center gap-2 text-label-sm font-label-sm text-on-surface-variant flex-wrap justify-center">
            <span>Active View:</span>
            <button
              type="button"
              onClick={navigateToHome}
              className={`px-2.5 py-0.5 rounded-full font-bold transition-colors cursor-pointer ${
                routeState.view === "home"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container hover:bg-surface-variant text-on-surface"
              }`}
            >
              Homepage
            </button>
            <button
              type="button"
              onClick={() => navigateToProducts()}
              className={`px-2.5 py-0.5 rounded-full font-bold transition-colors cursor-pointer ${
                routeState.view === "products"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container hover:bg-surface-variant text-on-surface"
              }`}
            >
              Product Listing (PLP)
            </button>
            <button
              type="button"
              onClick={() => navigateToProductDetails(routeState.param || "prod-1")}
              className={`px-2.5 py-0.5 rounded-full font-bold transition-colors cursor-pointer ${
                routeState.view === "product-details"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container hover:bg-surface-variant text-on-surface"
              }`}
            >
              Product Details (PDP)
            </button>
            <button
              type="button"
              onClick={() => navigateToSearch("headphones")}
              className={`px-2.5 py-0.5 rounded-full font-bold transition-colors cursor-pointer ${
                routeState.view === "search"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container hover:bg-surface-variant text-on-surface"
              }`}
            >
              Search Results
            </button>
            <button
              type="button"
              onClick={navigateToLogin}
              className={`px-2.5 py-0.5 rounded-full font-bold transition-colors cursor-pointer ${
                routeState.view === "login"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container hover:bg-surface-variant text-on-surface"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={navigateToRegister}
              className={`px-2.5 py-0.5 rounded-full font-bold transition-colors cursor-pointer ${
                routeState.view === "register"
                  ? "bg-primary text-on-primary shadow-xs"
                  : "bg-surface-container hover:bg-surface-variant text-on-surface"
              }`}
            >
              Register
            </button>
          </div>
        </div>
      )}

      {routeState.view === "home" && (
        <HomePage
          onProductClick={(id) => navigateToProductDetails(id)}
          onCategoryClick={(catId) => navigateToProducts(catId)}
          onAddToCart={(id) => console.log("Add to cart:", id)}
        />
      )}

      {routeState.view === "products" && (
        <ProductListingPage
          initialCategoryId={routeState.param}
          onProductClick={(id) => navigateToProductDetails(id)}
          onAddToCart={(id) => console.log("PLP Add to cart:", id)}
          onNavigateHome={navigateToHome}
        />
      )}

      {routeState.view === "product-details" && (
        <ProductDetailsPage
          productId={routeState.param || "prod-1"}
          onNavigateHome={navigateToHome}
          onNavigateCategory={(catId) => navigateToProducts(catId)}
          onNavigateProduct={(id) => navigateToProductDetails(id)}
        />
      )}

      {routeState.view === "search" && (
        <SearchResultsPage
          initialQuery={routeState.param || ""}
          onProductClick={(id) => navigateToProductDetails(id)}
          onAddToCart={(id) => console.log("Search Add to cart:", id)}
          onNavigateHome={navigateToHome}
          onSearchSubmit={(newQuery) => navigateToSearch(newQuery)}
          onCategoryClick={(catId) => navigateToProducts(catId)}
        />
      )}

      {routeState.view === "login" && (
        <LoginPage
          onNavigateHome={navigateToHome}
          onNavigateRegister={navigateToRegister}
          onNavigateForgotPassword={navigateToForgotPassword}
        />
      )}

      {routeState.view === "register" && (
        <RegisterPage
          onNavigateHome={navigateToHome}
          onNavigateLogin={navigateToLogin}
        />
      )}

      {routeState.view === "forgot-password" && (
        <ForgotPasswordPage
          onNavigateHome={navigateToHome}
          onNavigateLogin={navigateToLogin}
        />
      )}
    </MainLayout>
    </>
  )
}

export default App
