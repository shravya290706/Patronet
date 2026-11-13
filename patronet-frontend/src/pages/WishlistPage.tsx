import { useCallback, useEffect, useState } from "react"
import { Heart } from "lucide-react"
import { Container } from "@/components/layout"
import { ProductCard, ProductGrid } from "@/components/products"
import { normalizeApiError } from "@/services/api.errors"
import { getWishlist } from "@/services/wishlist.service"
import { mapApiProductToCard } from "@/services/mappers/product.mapper"
import type { ApiWishlistItem } from "@/types/api.types"

interface WishlistPageProps {
  onProductClick?: (id: string) => void
  onAddToCart?: (id: string) => void | Promise<void>
  onToggleWishlist?: (id: string) => void | Promise<void>
  onBrowse?: () => void
}

export function WishlistPage({
  onProductClick,
  onAddToCart,
  onToggleWishlist,
  onBrowse,
}: WishlistPageProps) {
  const [items, setItems] = useState<ApiWishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadWishlist = useCallback(async () => {
    try {
      const response = await getWishlist()
      setItems(response.items)
      setError(null)
    } catch (rawError) {
      setError(normalizeApiError(rawError).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadWishlist()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadWishlist])

  const toggleItem = async (productId: string) => {
    await onToggleWishlist?.(productId)
    setItems((current) => current.filter((item) => item.product.id !== productId))
  }

  return (
    <Container className="py-space-xl">
      <h1 className="font-headline-lg text-headline-lg text-primary font-bold">Your Wishlist</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mt-1 mb-space-lg">Products you have saved for later.</p>
      {error && <p role="alert" className="mb-space-md rounded-lg bg-error-container p-3 text-error">{error}</p>}
      {loading ? (
        <p role="status" className="py-space-xl text-center text-on-surface-variant">Loading wishlist…</p>
      ) : items.length ? (
        <ProductGrid columns={4}>
          {items.map(({ product }) => (
            <ProductCard
              key={product.id}
              product={mapApiProductToCard(product)}
              onViewDetails={onProductClick}
              onAddToCart={onAddToCart}
              onToggleWishlist={toggleItem}
              isWishlisted
            />
          ))}
        </ProductGrid>
      ) : (
        <div className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-xl text-center">
          <Heart className="h-10 w-10 mx-auto text-outline" />
          <h2 className="font-title-md text-title-md font-semibold mt-space-sm">No saved products yet</h2>
          <p className="text-body-md text-on-surface-variant mt-1">Tap the heart on a product to add it here.</p>
          <button type="button" onClick={onBrowse} className="mt-space-md rounded-lg bg-primary px-space-md py-2.5 text-on-primary font-label-md font-bold">Browse products</button>
        </div>
      )}
    </Container>
  )
}
