import { useState } from "react"
import { Check, Eye, Heart, Plus, Scale } from "lucide-react"
import type { UiProductCardModel } from "@/types/ui.types"
import { cn } from "@/lib/utils"
import { normalizeApiError } from "@/services/api.errors"
import { useSmartShopping } from "@/components/smart-shopping"

export type ProductCardData = UiProductCardModel

interface ProductCardProps {
  product: ProductCardData
  onViewDetails?: (id: string) => void
  onAddToCart?: (id: string) => void | Promise<void>
  onToggleWishlist?: (id: string) => void | Promise<void>
  isWishlisted?: boolean
  className?: string
}

export function ProductCard({
  product,
  onViewDetails,
  onAddToCart,
  onToggleWishlist,
  isWishlisted = false,
  className,
}: ProductCardProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [isTogglingWishlist, setIsTogglingWishlist] = useState(false)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  const { addToCompare, isCompared } = useSmartShopping()
  const isItemCompared = isCompared(product.id)

  // Format price in Indian numbering system
  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(product.price)

  const handleAddClick = async () => {
    if (!onAddToCart || isAdding) return
    setIsAdding(true)
    setActionMessage(null)
    try {
      await onAddToCart(product.id)
      setActionMessage("Added to your cart.")
    } catch (error) {
      setActionMessage(normalizeApiError(error).message)
    } finally {
      setIsAdding(false)
    }
  }

  const handleWishlistClick = async () => {
    if (!onToggleWishlist || isTogglingWishlist) return
    setIsTogglingWishlist(true)
    setActionMessage(null)
    try {
      await onToggleWishlist(product.id)
    } catch (error) {
      setActionMessage(normalizeApiError(error).message)
    } finally {
      setIsTogglingWishlist(false)
    }
  }

  return (
    <div
      className={cn(
        "group bg-surface-container-lowest rounded-xl p-space-md shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between relative border border-surface-container/60",
        className
      )}
    >
      <div>
        {/* Product Image Viewport */}
        <div className="relative w-full aspect-square bg-surface-container-low rounded-lg overflow-hidden mb-space-sm flex items-center justify-center">
          {/* Compare Buddy Quick Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              addToCompare(product)
            }}
            aria-label={isItemCompared ? "Remove from Compare Buddy" : "Add to Compare Buddy"}
            aria-pressed={isItemCompared}
            title={isItemCompared ? "Click to remove from Compare Buddy" : "Click to compare up to 4 items"}
            className={cn(
              "absolute top-2 left-2 z-20 h-7.5 rounded-lg px-2.5 py-1 text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer select-none",
              isItemCompared
                ? "bg-primary text-on-primary ring-2 ring-primary/40 shadow-md"
                : "bg-surface-container-lowest/95 text-on-surface hover:text-primary hover:bg-surface-container-lowest border border-surface-container-high/80"
            )}
          >
            {isItemCompared ? (
              <>
                <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                <span>Compared</span>
              </>
            ) : (
              <>
                <Scale className="h-3.5 w-3.5" />
                <span>+ Compare</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => onViewDetails?.(product.id)}
            disabled={!onViewDetails}
            aria-label={`View ${product.name}`}
            className="w-full h-full scroll-mt-48 cursor-pointer disabled:cursor-default"
          >
            <img
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(event) => {
                event.currentTarget.onerror = null
                event.currentTarget.src =
                  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500&q=80"
              }}
            />
          </button>
          <button
            type="button"
            onClick={handleWishlistClick}
            disabled={!onToggleWishlist || isTogglingWishlist}
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={isWishlisted}
            className="absolute top-2 right-2 rounded-full bg-surface-container-lowest/90 p-2 text-outline shadow-sm transition-colors hover:text-primary disabled:hidden"
          >
            <Heart
              className={cn("h-4 w-4", isWishlisted && "fill-current text-primary")}
            />
          </button>
        </div>

        {/* Brand & Category line */}
        <div className="flex items-center justify-between gap-1 mb-1">
          {product.brand && (
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
              {product.brand}
            </span>
          )}
          {product.categoryName && (
            <span className="font-label-sm text-label-sm text-outline truncate">
              {product.categoryName}
            </span>
          )}
        </div>

        {/* Product Title (2-line clamp) */}
        <h3 className="font-title-md text-title-md text-on-surface font-semibold line-clamp-2 leading-snug group-hover:text-primary transition-colors">
          <button
            type="button"
            onClick={() => onViewDetails?.(product.id)}
            disabled={!onViewDetails}
            className="text-left scroll-mt-48 cursor-pointer disabled:cursor-default"
          >
            {product.name}
          </button>
        </h3>

        {/* SKU Metadata line */}
        <div className="flex items-center justify-between text-label-sm text-label-sm text-outline my-1.5">
          <span>SKU: {product.sku}</span>
        </div>

        {/* Price Presentation in INR */}
        <div className="flex items-baseline gap-2 mt-1">
          <span className="font-headline-sm text-headline-sm font-bold text-primary">
            {formattedPrice}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-1.5 mt-3 pt-2 border-t border-surface-container/50">
        <button
          type="button"
          onClick={() => onViewDetails?.(product.id)}
          disabled={!onViewDetails}
          className="w-full scroll-mt-48 py-2 px-2 rounded-lg bg-surface-container-low hover:bg-primary-fixed text-primary font-label-md text-label-md transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Details</span>
        </button>

        <button
          type="button"
          onClick={handleAddClick}
          disabled={!onAddToCart || isAdding}
          className="w-full py-2 px-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{isAdding ? "Adding…" : "Add"}</span>
        </button>
      </div>
      {actionMessage && (
        <p role="status" className="mt-2 text-label-sm text-on-surface-variant">
          {actionMessage}
        </p>
      )}
    </div>
  )
}
