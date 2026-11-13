import { Eye, Plus } from "lucide-react"
import type { UiProductCardModel } from "@/types/ui.types"
import { cn } from "@/lib/utils"

export type ProductCardData = UiProductCardModel

interface ProductCardProps {
  product: ProductCardData
  onViewDetails?: (id: string) => void
  onAddToCart?: (id: string) => void
  className?: string
}

export function ProductCard({
  product,
  onViewDetails,
  onAddToCart,
  className,
}: ProductCardProps) {
  // Format price in Indian numbering system
  const formattedPrice = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(product.price)

  const handleDetailsClick = () => {
    if (onViewDetails) {
      onViewDetails(product.id)
    } else {
      alert(`Product details view for SKU ${product.sku} will connect in Phase 6.`)
    }
  }

  const handleAddClick = () => {
    if (onAddToCart) {
      onAddToCart(product.id)
    } else {
      alert(`Added ${product.name} (SKU: ${product.sku}) to local session list.`)
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
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            onError={(e) => {
              const target = e.currentTarget
              target.onerror = null
              target.src = "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500&q=80"
            }}
          />
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
          {product.name}
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
          onClick={handleDetailsClick}
          className="w-full py-2 px-2 rounded-lg bg-surface-container-low hover:bg-primary-fixed text-primary font-label-md text-label-md transition-colors flex items-center justify-center gap-1 cursor-pointer"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Details</span>
        </button>

        <button
          type="button"
          onClick={handleAddClick}
          className="w-full py-2 px-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-label-md text-label-md transition-colors shadow-xs flex items-center justify-center gap-1 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add</span>
        </button>
      </div>
    </div>
  )
}
