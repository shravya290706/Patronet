import { useState, useEffect, useCallback } from "react"
import { MainLayout, BrandIntro } from "@/components/layout"
import { HomePage } from "@/pages/HomePage"
import { ProductListingPage } from "@/pages/ProductListingPage"
import { ProductDetailsPage } from "@/pages/ProductDetailsPage"
import { SearchResultsPage } from "@/pages/SearchResultsPage"
import { LoginPage, RegisterPage, ForgotPasswordPage } from "@/pages"
import type { SearchSuggestionItem } from "@/mocks/search.mock"
import { CartPage } from "@/pages/CartPage"
import { WishlistPage } from "@/pages/WishlistPage"
import { AddressesPage } from "@/pages/AddressesPage"
import { CheckoutPage } from "@/pages/CheckoutPage"
import { OrdersPage } from "@/pages/OrdersPage"
import { addCartItem, getCart } from "@/services/cart.service"
import { authService } from "@/services/auth.service"
import { addWishlistItem, getWishlist, removeWishlistItem } from "@/services/wishlist.service"
import { isAuthenticated } from "@/services/token.store"
import { normalizeApiError } from "@/services/api.errors"
import { isBackendUuid } from "@/services/product.service"
import type { ApiCustomerProfile, ApiOrderResponse } from "@/types/api.types"

type ViewMode = "home" | "products" | "product-details" | "search" | "login" | "register" | "forgot-password" | "cart" | "wishlist" | "addresses" | "checkout" | "orders" | "order-details" | "info"

interface RouteState {
  view: ViewMode
  param?: string
  sort?: "newest" | "price_asc" | "price_desc"
}

type PendingPostLoginAction =
  | { type: "cart"; productId: string; quantity: number }
  | { type: "wishlist"; productId: string }

function isProtectedView(view: ViewMode): boolean {
  return ["cart", "wishlist", "addresses", "checkout", "orders", "order-details"].includes(view)
}

function parseHash(): RouteState {
  const hash = window.location.hash
  if (hash === "#cart") return { view: "cart" }
  if (hash === "#wishlist") return { view: "wishlist" }
  if (hash === "#addresses") return { view: "addresses" }
  if (hash === "#checkout") return { view: "checkout" }
  if (hash === "#orders") return { view: "orders" }
  if (hash.startsWith("#order/")) {
    return { view: "order-details", param: hash.replace("#order/", "").trim() }
  }
  if (hash.startsWith("#info/")) {
    return { view: "info", param: hash.replace("#info/", "").trim() }
  }
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
    let query = rawQuery
    try {
      query = decodeURIComponent(rawQuery)
    } catch {
      // Keep malformed URL text visible in the search field.
    }
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
    const sort = params.get("sort")
    return {
      view: "products",
      param: isBackendUuid(categoryId) ? categoryId : undefined,
      sort: sort === "price_asc" || sort === "price_desc" ? sort : "newest",
    }
  }
  return { view: "home" }
}

function App() {
  const [routeState, setRouteState] = useState<RouteState>(() => {
    const initialRoute = parseHash()
    return isProtectedView(initialRoute.view) && !isAuthenticated()
      ? { view: "login" }
      : initialRoute
  })
  const [customer, setCustomer] = useState<ApiCustomerProfile | null>(null)
  const [cartCount, setCartCount] = useState(0)
  const [wishlistProductIds, setWishlistProductIds] = useState<ReadonlySet<string>>(new Set())
  const [accountError, setAccountError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingPostLoginAction | null>(null)
  const [pendingRoute, setPendingRoute] = useState<string | null>(() => {
    const initialRoute = parseHash()
    return isProtectedView(initialRoute.view) && !isAuthenticated()
      ? window.location.hash || "#"
      : null
  })
  const [showBrandIntro, setShowBrandIntro] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("patronet_brand_intro_shown") !== "true"
    } catch {
      return false
    }
  })

  const refreshAccountData = useCallback(async () => {
    try {
      const profile = await authService.getProfile()
      setAccountError(null)
      setCustomer(profile)
      if (!profile) {
        setCartCount(0)
        setWishlistProductIds(new Set())
        const currentRoute = parseHash()
        if (isProtectedView(currentRoute.view)) {
          setPendingRoute(window.location.hash || "#")
          window.location.hash = "#login"
          setRouteState({ view: "login" })
        }
        return
      }
      const [cart, wishlist] = await Promise.all([getCart(), getWishlist()])
      setCartCount(cart.total_quantity)
      setWishlistProductIds(new Set(wishlist.items.map((item) => item.product.id)))
    } catch (error) {
      setAccountError(normalizeApiError(error).message)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshAccountData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refreshAccountData])

  const handleIntroComplete = () => {
    setShowBrandIntro(false)
  }

  useEffect(() => {
    const handleHashChange = () => {
      const nextRoute = parseHash()
      if (isProtectedView(nextRoute.view) && !isAuthenticated()) {
        setPendingRoute(window.location.hash || "#")
        window.location.hash = "#login"
        setRouteState({ view: "login" })
        return
      }
      setRouteState(nextRoute)
    }

    window.addEventListener("hashchange", handleHashChange)
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])

  useEffect(() => {
    const handleExpiredSession = () => {
      setCustomer(null)
      setCartCount(0)
      setWishlistProductIds(new Set())
      if (isProtectedView(parseHash().view)) {
        setPendingRoute(window.location.hash || "#")
        window.location.hash = "#login"
        setRouteState({ view: "login" })
      }
    }
    window.addEventListener("patronet:auth-expired", handleExpiredSession)
    return () => window.removeEventListener("patronet:auth-expired", handleExpiredSession)
  }, [])

  const navigateToHome = () => {
    window.location.hash = ""
    setRouteState({ view: "home" })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const navigateToProducts = (
    categoryId?: string,
    sort: RouteState["sort"] = "newest"
  ) => {
    const params = new URLSearchParams()
    if (isBackendUuid(categoryId)) params.set("category", categoryId)
    if (sort && sort !== "newest") params.set("sort", sort)
    const query = params.toString()
    const newHash = query ? `#products?${query}` : "#products"
    window.location.hash = newHash
    setRouteState({
      view: "products",
      param: isBackendUuid(categoryId) ? categoryId : undefined,
      sort,
    })
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

  const navigateToRoute = (hash: string, view: ViewMode, param?: string) => {
    window.location.hash = hash
    setRouteState({ view, param })
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const navigateToProtected = (hash: string, view: ViewMode) => {
    if (!isAuthenticated()) {
      setPendingRoute(hash)
      navigateToLogin()
      return
    }
    navigateToRoute(hash, view)
  }

  const handleLoginSuccess = async () => {
    await refreshAccountData()
    if (pendingAction) {
      try {
        if (pendingAction.type === "cart") {
          const cart = await addCartItem({
            product_id: pendingAction.productId,
            quantity: pendingAction.quantity,
          })
          setCartCount(cart.total_quantity)
        } else {
          await addWishlistItem(pendingAction.productId)
          setWishlistProductIds((current) => new Set(current).add(pendingAction.productId))
        }
      } catch (error) {
        setAccountError(normalizeApiError(error).message)
      } finally {
        setPendingAction(null)
      }
    }
    if (pendingRoute) {
      const next = pendingRoute
      setPendingRoute(null)
      window.location.hash = next
      setRouteState(parseHash())
    } else {
      navigateToHome()
    }
  }

  const handleLogout = () => {
    authService.logout()
    setCustomer(null)
    setCartCount(0)
    setWishlistProductIds(new Set())
    setPendingAction(null)
    setPendingRoute(null)
    navigateToHome()
  }

  const handleAddToCart = async (productId: string, quantity = 1) => {
    if (!isAuthenticated()) {
      setPendingAction({ type: "cart", productId, quantity })
      setPendingRoute("#cart")
      navigateToLogin()
      throw new Error("Please sign in to add products to your bag.")
    }
    const cart = await addCartItem({ product_id: productId, quantity })
    setCartCount(cart.total_quantity)
  }

  const handleToggleWishlist = async (productId: string) => {
    if (!isAuthenticated()) {
      setPendingAction({ type: "wishlist", productId })
      setPendingRoute("#wishlist")
      navigateToLogin()
      throw new Error("Please sign in to save products to your wishlist.")
    }
    if (wishlistProductIds.has(productId)) {
      await removeWishlistItem(productId)
      setWishlistProductIds((current) => {
        const next = new Set(current)
        next.delete(productId)
        return next
      })
    } else {
      await addWishlistItem(productId)
      setWishlistProductIds((current) => new Set(current).add(productId))
    }
  }

  const handleSuggestionSelect = (suggestion: SearchSuggestionItem) => {
    if (suggestion.type === "product" && suggestion.targetId) {
      navigateToProductDetails(suggestion.targetId)
    } else if (
      suggestion.type === "category" &&
      suggestion.targetId &&
      isBackendUuid(suggestion.targetId)
    ) {
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
        onCategorySelect={(category) => {
          if (category === "all" || isBackendUuid(category)) {
            navigateToProducts(isBackendUuid(category) ? category : undefined)
          } else if (category === "deals" || category === "offers") {
            navigateToSearch(category)
          } else if (category === "new-arrivals") {
            navigateToProducts(undefined, "newest")
          } else {
            navigateToRoute(`#info/${encodeURIComponent(category)}`, "info", category)
          }
        }}
        onLocationClick={() => navigateToProtected("#addresses", "addresses")}
        isAuthenticated={Boolean(customer)}
        customerName={customer?.name}
        cartCount={cartCount}
        wishlistCount={wishlistProductIds.size}
        onLogout={handleLogout}
      >
      {accountError && (
        <div role="alert" className="bg-error-container px-gutter py-2 text-center text-body-sm text-error">
          Account data could not be refreshed: {accountError}
        </div>
      )}
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
              onClick={() => navigateToProductDetails(routeState.param || "")}
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
          onCategoryClick={(catId) => {
            if (catId === "offers") navigateToSearch("offers")
            else if (catId === "new-arrivals") navigateToProducts(undefined, "newest")
            else navigateToProducts(catId)
          }}
          onAddToCart={(id) => handleAddToCart(id)}
          onToggleWishlist={handleToggleWishlist}
          wishlistedProductIds={wishlistProductIds}
        />
      )}

      {routeState.view === "products" && (
        <ProductListingPage
          key={`${routeState.param || "all"}:${routeState.sort || "newest"}`}
          initialCategoryId={routeState.param}
          initialSort={routeState.sort}
          onProductClick={(id) => navigateToProductDetails(id)}
          onAddToCart={(id) => handleAddToCart(id)}
          onToggleWishlist={handleToggleWishlist}
          wishlistedProductIds={wishlistProductIds}
          onNavigateHome={navigateToHome}
        />
      )}

      {routeState.view === "product-details" && (
        <ProductDetailsPage
          productId={routeState.param || ""}
          onNavigateHome={navigateToHome}
          onNavigateCategory={(catId) => navigateToProducts(catId)}
          onNavigateProduct={(id) => navigateToProductDetails(id)}
          onNavigateLogin={navigateToLogin}
          onAddToCart={handleAddToCart}
          onToggleWishlist={handleToggleWishlist}
          wishlistedProductIds={wishlistProductIds}
        />
      )}

      {routeState.view === "search" && (
        <SearchResultsPage
          initialQuery={routeState.param || ""}
          onProductClick={(id) => navigateToProductDetails(id)}
          onAddToCart={(id) => handleAddToCart(id)}
          onToggleWishlist={handleToggleWishlist}
          wishlistedProductIds={wishlistProductIds}
          onNavigateHome={navigateToHome}
          onSearchSubmit={(newQuery) => navigateToSearch(newQuery)}
          onCategoryClick={(catId) => navigateToProducts(catId)}
        />
      )}

      {routeState.view === "cart" && (
        <CartPage
          onBrowse={() => navigateToProducts()}
          onCheckout={() => navigateToProtected("#checkout", "checkout")}
        />
      )}
      {routeState.view === "wishlist" && (
        <WishlistPage
          onProductClick={navigateToProductDetails}
          onAddToCart={(id) => handleAddToCart(id)}
          onToggleWishlist={handleToggleWishlist}
          onBrowse={() => navigateToProducts()}
        />
      )}
      {routeState.view === "addresses" && (
        <AddressesPage onContinue={() => navigateToProtected("#checkout", "checkout")} />
      )}
      {routeState.view === "checkout" && (
        <CheckoutPage
          onManageAddresses={() => navigateToProtected("#addresses", "addresses")}
          onBrowse={() => navigateToProducts()}
          onOrderPlaced={(order: ApiOrderResponse) => {
            setCartCount(0)
            void refreshAccountData()
            navigateToRoute(`#order/${encodeURIComponent(order.id)}`, "order-details", order.id)
          }}
        />
      )}
      {routeState.view === "orders" && <OrdersPage onBrowse={() => navigateToProducts()} />}
      {routeState.view === "order-details" && (
        <OrdersPage orderId={routeState.param} onBrowse={() => navigateToProducts()} />
      )}
      {routeState.view === "info" && (
        <div className="mx-auto max-w-3xl px-gutter py-space-xl text-center">
          <h1 className="font-headline-lg text-headline-lg text-primary font-bold">
            {(routeState.param || "Information").replaceAll("-", " ")}
          </h1>
          <p className="mt-space-sm text-body-md text-on-surface-variant">
            This information page is not connected yet. For account support, use the order history or address management available from your account menu.
          </p>
          <button type="button" onClick={navigateToHome} className="mt-space-md rounded-lg bg-primary px-space-md py-2.5 text-on-primary font-label-md font-bold">
            Return to marketplace
          </button>
        </div>
      )}

      {routeState.view === "login" && (
        <LoginPage
          onNavigateHome={navigateToHome}
          onNavigateRegister={navigateToRegister}
          onNavigateForgotPassword={navigateToForgotPassword}
          onLoginSuccess={() => { void handleLoginSuccess() }}
        />
      )}

      {routeState.view === "register" && (
        <RegisterPage
          onNavigateHome={navigateToHome}
          onNavigateLogin={navigateToLogin}
          onRegisterSuccess={navigateToLogin}
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
