import { useState, useEffect } from "react"
import {
  Home,
  Package,
  Search,
  ShoppingCart,
  Heart,
  Clock,
  MapPin,
  CreditCard,
  User,
  LogIn,
  UserPlus,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  PanelLeft,
  Layers,
  X,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { getUiCategories } from "@/services/category.service"
import { mockHomepageCategories } from "@/mocks/categories.mock"
import type { UiCategoryModel } from "@/types/ui.types"

export interface AppSidebarProps {
  activeView?: string
  selectedCategoryId?: string
  categories?: UiCategoryModel[]
  onCategorySelect?: (categoryId: string) => void
  onNavigateHome?: () => void
  onNavigateProducts?: (categoryId?: string) => void
  onNavigateSearch?: () => void
  onNavigateCart?: () => void
  onNavigateWishlist?: () => void
  onNavigateOrders?: () => void
  onNavigateAddresses?: () => void
  onNavigateCheckout?: () => void
  onNavigateLogin?: () => void
  onNavigateRegister?: () => void
  cartCount?: number
  wishlistCount?: number
  isAuthenticated?: boolean
  customerName?: string
  onLogout?: () => void
  className?: string
}

interface NavItemDef {
  id: string
  label: string
  icon: LucideIcon
  onClick?: () => void
  isActive: boolean
  badge?: number | string
}

export function AppSidebar({
  activeView = "home",
  selectedCategoryId,
  categories,
  onCategorySelect,
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
  cartCount = 0,
  wishlistCount = 0,
  isAuthenticated = false,
  customerName,
  onLogout,
  className,
}: AppSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [internalCategories, setInternalCategories] = useState<UiCategoryModel[]>(mockHomepageCategories)
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(true)
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set())
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(new Set())

  // Load backend categories if not supplied by parent
  useEffect(() => {
    if (categories && categories.length > 0) return
    getUiCategories()
      .then((data) => {
        if (data && data.length > 0) {
          setInternalCategories(data)
        }
      })
      .catch(() => {
        // Retain mockHomepageCategories fallback
      })
  }, [categories])

  const categoriesList = categories && categories.length > 0 ? categories : internalCategories

  // Determine whether a parent category is expanded (user-expanded or contains the active subcategory)
  const isCategoryExpanded = (cat: UiCategoryModel) => {
    if (collapsedParentIds.has(cat.id)) return false
    if (expandedParentIds.has(cat.id)) return true
    return Boolean(cat.subcategories?.some((s) => s.id === selectedCategoryId))
  }

  const toggleCategoryExpanded = (cat: UiCategoryModel) => {
    const isExpanded = isCategoryExpanded(cat)
    if (isExpanded) {
      setCollapsedParentIds((prev) => new Set([...prev, cat.id]))
      setExpandedParentIds((prev) => {
        const next = new Set(prev)
        next.delete(cat.id)
        return next
      })
    } else {
      setExpandedParentIds((prev) => new Set([...prev, cat.id]))
      setCollapsedParentIds((prev) => {
        const next = new Set(prev)
        next.delete(cat.id)
        return next
      })
    }
  }

  const handleCategoryClick = (categoryId: string) => {
    if (onCategorySelect) {
      onCategorySelect(categoryId)
    } else if (onNavigateProducts) {
      onNavigateProducts(categoryId)
    }
    setIsMobileOpen(false)
  }

  const browsingItems: NavItemDef[] = [
    {
      id: "home",
      label: "Home",
      icon: Home,
      onClick: onNavigateHome,
      isActive: activeView === "home",
    },
    {
      id: "products",
      label: "Products",
      icon: Package,
      onClick: () => {
        onNavigateProducts?.()
      },
      isActive: activeView === "products" && !selectedCategoryId,
    },
    {
      id: "search",
      label: "Search",
      icon: Search,
      onClick: onNavigateSearch,
      isActive: activeView === "search",
    },
  ]

  const commerceItems: NavItemDef[] = [
    {
      id: "cart",
      label: "Cart",
      icon: ShoppingCart,
      onClick: onNavigateCart,
      isActive: activeView === "cart",
      badge: cartCount > 0 ? (cartCount > 99 ? "99+" : cartCount) : undefined,
    },
    {
      id: "wishlist",
      label: "Wishlist",
      icon: Heart,
      onClick: onNavigateWishlist,
      isActive: activeView === "wishlist",
      badge: wishlistCount > 0 ? (wishlistCount > 99 ? "99+" : wishlistCount) : undefined,
    },
    {
      id: "orders",
      label: "Orders",
      icon: Clock,
      onClick: onNavigateOrders,
      isActive: activeView === "orders" || activeView === "order-details",
    },
    {
      id: "addresses",
      label: "Addresses",
      icon: MapPin,
      onClick: onNavigateAddresses,
      isActive: activeView === "addresses",
    },
    {
      id: "checkout",
      label: "Checkout",
      icon: CreditCard,
      onClick: onNavigateCheckout,
      isActive: activeView === "checkout",
    },
  ]

  const handleItemClick = (item: NavItemDef) => {
    item.onClick?.()
    setIsMobileOpen(false)
  }

  const renderNavButton = (item: NavItemDef, compact = false) => {
    const Icon = item.icon
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleItemClick(item)}
        title={compact ? item.label : undefined}
        className={cn(
          "w-full flex items-center gap-3 rounded-xl transition-all duration-150 cursor-pointer text-left select-none",
          compact ? "justify-center p-2.5" : "px-3.5 py-2.5",
          item.isActive
            ? "bg-primary text-on-primary font-bold shadow-xs"
            : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low font-medium"
        )}
      >
        <Icon className={cn("flex-shrink-0", compact ? "h-5 w-5" : "h-4 w-4")} />
        {!compact && (
          <span className="flex-1 truncate text-label-md">{item.label}</span>
        )}
        {Boolean(item.badge) && !compact && (
          <span
            className={cn(
              "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center leading-none",
              item.isActive
                ? "bg-on-primary text-primary"
                : "bg-primary text-on-primary"
            )}
          >
            {item.badge}
          </span>
        )}
        {Boolean(item.badge) && compact && (
          <span className="sr-only">({item.badge})</span>
        )}
      </button>
    )
  }

  const renderCategoriesSection = (compact = false) => {
    if (compact) {
      return (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            title={
              selectedCategoryId
                ? `Categories (${categoriesList.find((c) => c.id === selectedCategoryId)?.name || "Filtered"})`
                : "Categories"
            }
            className={cn(
              "w-full flex items-center justify-center p-2.5 rounded-xl transition-all duration-150 cursor-pointer select-none",
              activeView === "products" && Boolean(selectedCategoryId)
                ? "bg-primary text-on-primary font-bold shadow-xs"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low font-medium"
            )}
          >
            <Layers className="h-5 w-5 flex-shrink-0" />
            <span className="sr-only">Categories</span>
          </button>
        </div>
      )
    }

    return (
      <div className="space-y-1 pt-1">
        {/* Collapsible Section Header */}
        <button
          type="button"
          onClick={() => setIsCategoriesOpen(!isCategoriesOpen)}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer group"
          aria-expanded={isCategoriesOpen}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Layers className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="text-label-md font-semibold text-on-surface truncate">Categories</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {categoriesList.length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant leading-none">
                {categoriesList.length}
              </span>
            )}
            {isCategoriesOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-outline group-hover:text-on-surface transition-transform" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-outline group-hover:text-on-surface transition-transform" />
            )}
          </div>
        </button>

        {/* Categories Vertical List (independently scrollable if long) */}
        {isCategoriesOpen && (
          <div
            tabIndex={0}
            role="region"
            aria-label="Category list"
            className="pl-3 pr-1 space-y-0.5 max-h-56 overflow-y-auto no-scrollbar py-0.5"
          >
            {categoriesList.map((cat) => {
              const isSelected = activeView === "products" && selectedCategoryId === cat.id
              const hasSubcategories = Boolean(cat.subcategories && cat.subcategories.length > 0)
              const isSubExpanded = isCategoryExpanded(cat)

              return (
                <div key={cat.id} className="space-y-0.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCategoryClick(cat.id)}
                      className={cn(
                        "flex-1 flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer text-left select-none min-w-0",
                        isSelected
                          ? "bg-primary text-on-primary font-bold shadow-xs"
                          : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low font-medium"
                      )}
                    >
                      <span className="truncate">{cat.name}</span>
                      {!hasSubcategories && (
                        <ChevronRight
                          className={cn(
                            "h-3 w-3 flex-shrink-0 ml-1 transition-opacity",
                            isSelected
                              ? "text-on-primary opacity-90"
                              : "text-outline/70 opacity-0 group-hover:opacity-100"
                          )}
                        />
                      )}
                    </button>

                    {hasSubcategories && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleCategoryExpanded(cat)
                        }}
                        className="p-1 rounded-md text-outline hover:text-on-surface hover:bg-surface-container-low cursor-pointer flex-shrink-0"
                        title={isSubExpanded ? "Collapse subcategories" : "Expand subcategories"}
                        aria-label={
                          isSubExpanded
                            ? `Collapse ${cat.name} subcategories`
                            : `Expand ${cat.name} subcategories`
                        }
                      >
                        {isSubExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Nested Subcategories List */}
                  {hasSubcategories && isSubExpanded && (
                    <div className="pl-3 border-l border-surface-container space-y-0.5 ml-2 py-0.5">
                      {cat.subcategories?.map((sub) => {
                        const isSubSelected =
                          activeView === "products" && selectedCategoryId === sub.id
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleCategoryClick(sub.id)}
                            className={cn(
                              "w-full flex items-center px-2 py-1 rounded-md text-[11px] transition-colors cursor-pointer text-left select-none",
                              isSubSelected
                                ? "bg-primary text-on-primary font-bold shadow-xs"
                                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low font-medium"
                            )}
                          >
                            <span className="truncate">{sub.name}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Mobile Floating Menu Trigger (visible only on small screens) */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        className="md:hidden fixed bottom-5 left-4 z-40 flex items-center gap-2 rounded-full bg-primary text-on-primary px-4 py-2.5 shadow-lg hover:bg-primary/90 transition-transform active:scale-95 text-xs font-bold cursor-pointer"
        aria-label="Open navigation sidebar"
      >
        <PanelLeft className="h-4 w-4" />
        <span>Menu</span>
        {(cartCount > 0 || wishlistCount > 0) && (
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
        )}
      </button>

      {/* Mobile Slide-Over Drawer with Backdrop */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="relative w-72 max-w-[85vw] bg-surface-container-lowest h-full shadow-2xl flex flex-col p-4 z-10 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container">
              <div className="flex items-center gap-2">
                <PanelLeft className="h-5 w-5 text-primary" />
                <span className="font-bold text-on-surface text-title-md">Navigation</span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface cursor-pointer"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-3 space-y-4 no-scrollbar">
              <div className="space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-outline px-3 pb-1">
                  Browse
                </p>
                {browsingItems.map((item) => renderNavButton(item))}
                {renderCategoriesSection(false)}
              </div>

              <div className="space-y-1 border-t border-surface-container pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-outline px-3 pb-1">
                  Shopping &amp; Activity
                </p>
                {commerceItems.map((item) => renderNavButton(item))}
              </div>

              <div className="space-y-1 border-t border-surface-container pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-outline px-3 pb-1">
                  Account
                </p>
                {isAuthenticated ? (
                  <>
                    <div className="px-3 py-2 rounded-xl bg-surface-container-low flex items-center gap-2.5 mb-1">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        <User className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-on-surface truncate">{customerName || "Customer"}</p>
                        <p className="text-[10px] text-emerald-600 font-medium">Signed In</p>
                      </div>
                    </div>
                    {onLogout && (
                      <button
                        type="button"
                        onClick={() => {
                          onLogout()
                          setIsMobileOpen(false)
                        }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-error hover:bg-error-container/20 transition-colors font-medium text-left cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        <span className="text-label-md">Sign Out</span>
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateLogin?.()
                        setIsMobileOpen(false)
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors font-medium text-left cursor-pointer",
                        activeView === "login"
                          ? "bg-primary text-on-primary font-bold"
                          : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                      )}
                    >
                      <LogIn className="h-4 w-4" />
                      <span className="text-label-md">Sign In</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onNavigateRegister?.()
                        setIsMobileOpen(false)
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-colors font-medium text-left cursor-pointer",
                        activeView === "register"
                          ? "bg-primary text-on-primary font-bold"
                          : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                      )}
                    >
                      <UserPlus className="h-4 w-4" />
                      <span className="text-label-md">Create Account</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col flex-shrink-0 border-r border-surface-container bg-surface-container-lowest sticky top-20 h-[calc(100vh-5rem)] z-30 transition-all duration-200 select-none",
          isCollapsed ? "w-18 px-2 py-4" : "w-60 lg:w-64 px-3.5 py-4",
          className
        )}
        aria-label="Application sidebar"
      >
        {/* Sidebar Header with Collapse Toggle */}
        <div className={cn("flex items-center pb-3 border-b border-surface-container/70 mb-3", isCollapsed ? "justify-center" : "justify-between px-1")}>
          {!isCollapsed && (
            <span className="text-xs font-bold uppercase tracking-wider text-outline">
              Menu
            </span>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* Scrollable Navigation Body */}
        <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar">
          {/* Main Browsing Section */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline px-3 pb-1">
                Browse
              </p>
            )}
            {browsingItems.map((item) => renderNavButton(item, isCollapsed))}
            {renderCategoriesSection(isCollapsed)}
          </div>

          {/* Commerce Section */}
          <div className="space-y-1 border-t border-surface-container/60 pt-3">
            {!isCollapsed && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline px-3 pb-1">
                Activity
              </p>
            )}
            {commerceItems.map((item) => renderNavButton(item, isCollapsed))}
          </div>

          {/* Account Section */}
          <div className="space-y-1 border-t border-surface-container/60 pt-3">
            {!isCollapsed && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-outline px-3 pb-1">
                Account
              </p>
            )}
            {isAuthenticated ? (
              <>
                {!isCollapsed ? (
                  <div className="px-3 py-2 rounded-xl bg-surface-container-low/60 flex items-center gap-2.5 mb-1 border border-surface-container/60">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                      <User className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-on-surface truncate">{customerName || "Customer"}</p>
                      <p className="text-[10px] text-emerald-600 font-medium">Signed In</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-center py-1" title={customerName || "Customer"}>
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <User className="h-4 w-4" />
                    </div>
                  </div>
                )}
                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    title={isCollapsed ? "Sign Out" : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-xl text-error hover:bg-error-container/20 transition-colors font-medium text-left cursor-pointer",
                      isCollapsed ? "justify-center p-2.5" : "px-3.5 py-2"
                    )}
                  >
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                    {!isCollapsed && <span className="text-label-md">Sign Out</span>}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onNavigateLogin}
                  title={isCollapsed ? "Sign In" : undefined}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl transition-colors font-medium text-left cursor-pointer select-none",
                    isCollapsed ? "justify-center p-2.5" : "px-3.5 py-2",
                    activeView === "login"
                      ? "bg-primary text-on-primary font-bold shadow-xs"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                  )}
                >
                  <LogIn className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && <span className="text-label-md">Sign In</span>}
                </button>
                <button
                  type="button"
                  onClick={onNavigateRegister}
                  title={isCollapsed ? "Create Account" : undefined}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-xl transition-colors font-medium text-left cursor-pointer select-none",
                    isCollapsed ? "justify-center p-2.5" : "px-3.5 py-2",
                    activeView === "register"
                      ? "bg-primary text-on-primary font-bold shadow-xs"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                  )}
                >
                  <UserPlus className="h-4 w-4 flex-shrink-0" />
                  {!isCollapsed && <span className="text-label-md">Create Account</span>}
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
