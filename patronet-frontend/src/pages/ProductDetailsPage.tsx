import { useState, useEffect } from "react"
import {
  ShoppingBag,
  Heart,
  AlertCircle,
  PackageOpen,
  MapPin,
  Check,
  ChevronRight,
  RotateCcw,
} from "lucide-react"

import { Container } from "@/components/layout"
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui"
import { ProductImageGallery, ProductCard, ProductGrid } from "@/components/products"
import { getUiProductDetail } from "@/services/product.service"
import { normalizeApiError } from "@/services/api.errors"
import {
  getMockProductDetailById,
  mockCatalogProducts,
} from "@/mocks/products.mock"
import type { UiProductDetailModel, UiProductCardModel } from "@/types/ui.types"

export interface ProductDetailsPageProps {
  productId: string
  onNavigateHome?: () => void
  onNavigateCategory?: (categoryId?: string) => void
  onNavigateProduct?: (id: string) => void
}

export function ProductDetailsPage({
  productId,
  onNavigateHome,
  onNavigateCategory,
  onNavigateProduct,
}: ProductDetailsPageProps) {
  // State
  const [product, setProduct] = useState<UiProductDetailModel | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState<number>(0)

  // Interactive controls
  const [quantity, setQuantity] = useState<number>(1)
  const [isWishlisted, setIsWishlisted] = useState<boolean>(false)
  const [cartSuccessMessage, setCartSuccessMessage] = useState<string | null>(null)

  // Pincode input state
  const [pincodeInput, setPincodeInput] = useState<string>("")
  const [pincodeFeedback, setPincodeFeedback] = useState<string | null>(null)

  // Fetch product detail
  useEffect(() => {
    let isCancelled = false

    async function loadDetail() {
      setIsLoading(true)
      setError(null)
      setCartSuccessMessage(null)

      try {
        const data = await getUiProductDetail(productId)
        if (!isCancelled) {
          setProduct(data)
        }
      } catch (rawError) {
        const err = normalizeApiError(rawError)
        const isDev = import.meta.env.DEV
        const isNetworkOrConfigError =
          err.isNetworkError || err.statusText === "CONFIG_ERROR"

        // In development mode, allow safe mock fallback ONLY when API is not configured or network unreachable
        if (isDev && isNetworkOrConfigError) {
          console.warn(
            `[PATRONET PDP] Backend API unreachable or not configured (${err.message}). Using local mock detail for development.`
          )
          const mockData = getMockProductDetailById(productId)
          if (!isCancelled) {
            if (mockData) {
              setProduct(mockData)
            } else {
              setProduct(null)
              setError("Product not found in catalog.")
            }
          }
        } else {
          // Genuine HTTP server error (404, 500, etc.) or production error:
          if (!isCancelled) {
            setProduct(null)
            setError(
              err.message ||
                `Failed to retrieve product details from server (HTTP ${err.status}: ${err.statusText})`
            )
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadDetail()

    return () => {
      isCancelled = true
    }
  }, [productId, reloadKey])

  // Quantity adjustments
  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => Math.max(1, prev + delta))
  }

  const handleQuantityInput = (val: string) => {
    const num = parseInt(val, 10)
    if (!isNaN(num) && num >= 1) {
      setQuantity(num)
    }
  }

  // Local Add to Cart confirmation
  const handleAddToCart = () => {
    if (!product) return
    setCartSuccessMessage(
      `Added ${quantity} × ${product.name} (SKU: ${product.sku}) to your local cart.`
    )
    setTimeout(() => {
      setCartSuccessMessage(null)
    }, 4500)
  }

  // Local Wishlist toggle
  const handleToggleWishlist = () => {
    setIsWishlisted((prev) => !prev)
  }

  // Pincode validation handler
  const handleCheckPincode = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = pincodeInput.trim()
    const pinRegex = /^[1-9][0-9]{5}$/ // 6-digit Indian PIN code format

    if (!clean) {
      setPincodeFeedback("Please enter a 6-digit pincode.")
      return
    }

    if (!pinRegex.test(clean)) {
      setPincodeFeedback("Invalid PIN code format. Please enter a valid 6-digit Indian postal code.")
      return
    }

    setPincodeFeedback(
      "Pincode format verified (6 digits). Live delivery serviceability will connect to the backend API."
    )
  }

  // Format price in INR
  const formattedPrice = product
    ? new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(product.price)
    : ""

  // Related products from same category or mock catalog
  const relatedProducts: UiProductCardModel[] = mockCatalogProducts
    .filter((p) => p.id !== productId)
    .slice(0, 4)

  // Breadcrumb navigation items
  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Home", href: "#", onClick: onNavigateHome },
    ...(product?.categoryName
      ? [
          {
            label: product.categoryName,
            href: "#products",
            onClick: () => onNavigateCategory && onNavigateCategory(product.categoryId),
          },
        ]
      : [{ label: "Catalog", href: "#products", onClick: () => onNavigateCategory && onNavigateCategory() }]),
    { label: product ? product.name : "Product Details" },
  ]

  return (
    <div className="bg-surface min-h-[calc(100vh-120px)] py-space-sm pb-space-xl">
      <Container>
        {/* Breadcrumb row */}
        <section className="pt-space-md pb-space-sm">
          <Breadcrumbs items={breadcrumbItems} className="mb-space-md" />
        </section>

        {/* STATE 1: Loading Skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start animate-pulse my-4">
            <div className="lg:col-span-6 space-y-space-md">
              <div className="w-full aspect-square bg-surface-container-low rounded-2xl" />
              <div className="grid grid-cols-4 gap-space-sm">
                <div className="aspect-square bg-surface-container-low rounded-xl" />
                <div className="aspect-square bg-surface-container-low rounded-xl" />
                <div className="aspect-square bg-surface-container-low rounded-xl" />
                <div className="aspect-square bg-surface-container-low rounded-xl" />
              </div>
            </div>
            <div className="lg:col-span-6 bg-surface-container-lowest rounded-2xl p-space-xl border border-surface-container/60 space-y-4">
              <div className="h-4 bg-surface-container-low rounded w-1/4" />
              <div className="h-8 bg-surface-container-low rounded w-3/4" />
              <div className="h-4 bg-surface-container-low rounded w-1/2" />
              <div className="h-12 bg-surface-container-low rounded w-1/3" />
              <div className="h-24 bg-surface-container-low rounded w-full" />
              <div className="h-12 bg-surface-container-low rounded w-full" />
            </div>
          </div>
        )}

        {/* STATE 2: Error State */}
        {!isLoading && error && (
          <div className="bg-surface-container-lowest rounded-2xl p-space-xl border border-error/20 text-center space-y-3 my-8 max-w-xl mx-auto shadow-sm">
            <div className="w-12 h-12 rounded-full bg-error-container text-error mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Unable to Display Product
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              {error}
            </p>
            <div className="pt-2 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              {onNavigateCategory && (
                <button
                  type="button"
                  onClick={() => onNavigateCategory()}
                  className="px-4 py-2 bg-surface-container-low text-on-surface hover:bg-surface-variant rounded-lg font-label-md text-label-md transition-colors cursor-pointer"
                >
                  Return to Catalog
                </button>
              )}
            </div>
          </div>
        )}

        {/* STATE 3: Product Not Found */}
        {!isLoading && !error && !product && (
          <div className="bg-surface-container-lowest rounded-2xl p-space-xl border border-surface-container/60 text-center space-y-3 my-8 max-w-xl mx-auto shadow-sm">
            <div className="w-14 h-14 rounded-full bg-surface-container-low text-outline mx-auto flex items-center justify-center">
              <PackageOpen className="w-7 h-7" />
            </div>
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Product Not Found
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant">
              The requested product does not exist or has been removed from the catalog.
            </p>
            {onNavigateCategory && (
              <button
                type="button"
                onClick={() => onNavigateCategory()}
                className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-md text-label-md hover:bg-primary-container transition-colors shadow-xs cursor-pointer inline-flex items-center gap-1.5 mt-2"
              >
                <span>Browse Available Products</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* STATE 4: Normal Product Details Display (Matches Stitch Layout) */}
        {!isLoading && !error && product && (
          <div className="space-y-space-xl">
            {/* Main Product Layout (Two-Column Desktop Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-start">
              {/* LEFT COLUMN: Media Gallery & Thumbnails */}
              <div className="lg:col-span-6">
                <ProductImageGallery
                  images={product.images}
                  productName={product.name}
                />
              </div>

              {/* RIGHT COLUMN: Buy Box & Product Overview */}
              <div className="lg:col-span-6 flex flex-col">
                <div className="bg-surface-container-lowest rounded-2xl p-space-md sm:p-space-xl shadow-sm border border-surface-container/60 flex flex-col gap-space-md">
                  {/* Brand & SKU line */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    {product.brand && (
                      <span className="px-2.5 py-1 rounded bg-surface-container-high text-primary font-label-sm text-label-sm tracking-widest uppercase font-bold">
                        {product.brand}
                      </span>
                    )}
                    <span className="font-mono text-body-sm text-outline">
                      SKU: {product.sku}
                    </span>
                  </div>

                  {/* Title & Category */}
                  <div>
                    <h1 className="font-display-sm text-display-sm text-on-surface leading-tight font-bold tracking-tight">
                      {product.name}
                    </h1>
                    {product.categoryName && (
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                        Category:{" "}
                        <span className="text-on-surface font-medium">
                          {product.categoryName}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* Price Block */}
                  <div className="flex items-baseline justify-between py-space-sm bg-surface-container-low/60 rounded-xl px-space-md">
                    <div className="flex items-baseline gap-space-sm">
                      <span className="font-headline-lg text-headline-lg text-primary font-bold">
                        {formattedPrice}
                      </span>
                    </div>
                  </div>

                  {/* Description snippet */}
                  {product.description && (
                    <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
                      {product.description}
                    </p>
                  )}

                  {/* Interactive Quantity Stepper & Add to Cart Action */}
                  <div className="flex flex-col sm:flex-row items-center gap-space-md pt-space-xs">
                    {/* Quantity counter */}
                    <div className="flex items-center bg-surface-container-low rounded-xl p-1 w-full sm:w-auto justify-between sm:justify-start border border-outline-variant/30">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(-1)}
                        disabled={quantity <= 1}
                        aria-label="Decrease quantity"
                        className="w-10 h-10 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center font-bold text-headline-sm select-none shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => handleQuantityInput(e.target.value)}
                        aria-label="Quantity"
                        className="w-12 text-center bg-transparent font-title-md text-title-md text-on-surface focus:outline-none [-moz-appearance:_textfield] [&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(1)}
                        aria-label="Increase quantity"
                        className="w-10 h-10 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container-high transition-colors flex items-center justify-center font-bold text-headline-sm select-none shadow-xs cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    {/* Primary Add to Cart Button */}
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      className="flex-1 w-full h-12 bg-primary hover:bg-primary-container text-on-primary rounded-xl font-label-md text-label-md flex items-center justify-center gap-space-sm shadow-xs transition-all duration-200 active:scale-[0.99] font-bold cursor-pointer"
                    >
                      <ShoppingBag className="w-5 h-5" />
                      <span>Add to Cart</span>
                    </button>

                    {/* Local Wishlist Button */}
                    <button
                      type="button"
                      onClick={handleToggleWishlist}
                      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                      className={`h-12 w-12 rounded-xl flex items-center justify-center transition-colors shadow-xs shrink-0 cursor-pointer ${
                        isWishlisted
                          ? "bg-secondary-container text-on-secondary"
                          : "bg-surface-container-low hover:bg-surface-container-high text-on-surface"
                      }`}
                    >
                      <Heart
                        className={`w-5 h-5 ${
                          isWishlisted ? "fill-current text-white" : "text-outline"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Cart Action Success Notification */}
                  {cartSuccessMessage && (
                    <div className="flex items-center gap-2 p-3 bg-primary-fixed/40 text-primary rounded-xl font-label-md text-label-md transition-all animate-fadeIn">
                      <Check className="w-4 h-4 shrink-0" />
                      <span>{cartSuccessMessage}</span>
                    </div>
                  )}

                  {/* Pincode Availability Check */}
                  <div className="border-t border-surface-container/60 pt-space-md mt-space-xs">
                    <span className="font-label-md text-label-md text-on-surface font-semibold flex items-center gap-1.5 mb-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <span>Check Delivery Availability</span>
                    </span>
                    <form
                      onSubmit={handleCheckPincode}
                      className="flex items-center gap-2"
                    >
                      <div className="relative flex-1">
                        <input
                          type="text"
                          maxLength={6}
                          value={pincodeInput}
                          onChange={(e) => setPincodeInput(e.target.value.replace(/\D/g, ""))}
                          placeholder="Enter 6-digit Pincode"
                          className="w-full bg-surface-container-low rounded-lg px-3 py-2 text-body-sm font-body-sm text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-surface-container-high hover:bg-surface-variant text-primary font-label-md text-label-md font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                      >
                        Check
                      </button>
                    </form>
                    {pincodeFeedback && (
                      <p className="font-body-sm text-body-sm text-on-surface-variant mt-2">
                        {pincodeFeedback}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Related Products in Category (Reusable ProductCard & ProductGrid) */}
            <div className="mt-space-xl flex flex-col gap-space-md pt-space-md border-t border-surface-container/60">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-space-xs">
                <div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface font-bold">
                    Related Products in {product.categoryName || "Category"}
                  </h2>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                    Explore matching items in our catalog
                  </p>
                </div>
                {onNavigateCategory && (
                  <button
                    type="button"
                    onClick={() => onNavigateCategory(product.categoryId)}
                    className="font-label-md text-label-md text-primary hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View all in category</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              <ProductGrid columns={4}>
                {relatedProducts.map((relProduct) => (
                  <ProductCard
                    key={relProduct.id}
                    product={relProduct}
                    onViewDetails={onNavigateProduct}
                  />
                ))}
              </ProductGrid>
            </div>
          </div>
        )}
      </Container>
    </div>
  )
}
