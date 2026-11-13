import { useCallback, useEffect, useState } from "react"
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react"
import { Container } from "@/components/layout"
import { normalizeApiError } from "@/services/api.errors"
import { getCart, removeCartItem, updateCartItem } from "@/services/cart.service"
import { formatPrice } from "@/lib/format-price"
import { resolveProductImage } from "@/services/mappers/product.mapper"
import type { ApiCartResponse } from "@/types/api.types"

interface CartPageProps {
  onBrowse?: () => void
  onCheckout?: () => void
}

export function CartPage({ onBrowse, onCheckout }: CartPageProps) {
  const [cart, setCart] = useState<ApiCartResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyItem, setBusyItem] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadCart = useCallback(async () => {
    try {
      setCart(await getCart())
      setError(null)
    } catch (rawError) {
      setError(normalizeApiError(rawError).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadCart()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [loadCart])

  const changeQuantity = async (itemId: string, quantity: number) => {
    setBusyItem(itemId)
    setError(null)
    try {
      setCart(await updateCartItem(itemId, { quantity }))
    } catch (rawError) {
      setError(normalizeApiError(rawError).message)
    } finally {
      setBusyItem(null)
    }
  }

  const removeItem = async (itemId: string) => {
    setBusyItem(itemId)
    setError(null)
    try {
      await removeCartItem(itemId)
      await loadCart()
    } catch (rawError) {
      setError(normalizeApiError(rawError).message)
    } finally {
      setBusyItem(null)
    }
  }

  return (
    <Container className="py-space-xl">
      <div className="flex flex-wrap items-end justify-between gap-space-md mb-space-lg">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary font-bold">Your Shopping Bag</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {cart?.total_quantity ?? 0} item{cart?.total_quantity === 1 ? "" : "s"}
          </p>
        </div>
        <button type="button" onClick={onBrowse} className="text-primary font-label-md hover:underline">
          Continue shopping
        </button>
      </div>

      {error && <p role="alert" className="mb-space-md rounded-lg bg-error-container p-3 text-error">{error}</p>}
      {loading ? (
        <p role="status" className="py-space-xl text-center text-on-surface-variant">Loading your bag…</p>
      ) : cart && cart.items.length > 0 ? (
        <div className="grid gap-gutter lg:grid-cols-[1fr_320px] items-start">
          <div className="space-y-space-sm">
            {cart.items.map((item) => {
              const rawImg =
                item.product.images.find((image) => image.is_primary)?.image_url ||
                item.product.images[0]?.image_url
              const imageUrl = resolveProductImage(
                rawImg,
                item.product.category?.name,
                item.product.sku || item.product.id,
                0
              )
              return (
                <article key={item.id} className="flex flex-col sm:flex-row gap-space-md rounded-xl border border-surface-container bg-surface-container-lowest p-space-md">
                  <img
                    src={imageUrl}
                    alt={item.product.name}
                    className="w-full sm:w-28 h-28 rounded-lg bg-surface-container-low object-contain p-2"
                  />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-title-md text-title-md text-on-surface font-semibold">{item.product.name}</h2>
                    <p className="text-body-sm text-outline mt-1">{item.product.brand || item.product.sku}</p>
                    <p className="font-title-md text-primary font-bold mt-2">{formatPrice(item.unit_price)}</p>
                    <p className="text-body-sm text-on-surface-variant">Line total: {formatPrice(item.subtotal)}</p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="flex items-center rounded-lg border border-surface-container">
                      <button type="button" aria-label="Decrease quantity" disabled={item.quantity <= 1 || busyItem === item.id} onClick={() => void changeQuantity(item.id, item.quantity - 1)} className="p-2 text-primary disabled:opacity-40"><Minus className="h-4 w-4" /></button>
                      <span className="min-w-8 text-center" aria-label={`Quantity ${item.quantity}`}>{item.quantity}</span>
                      <button type="button" aria-label="Increase quantity" disabled={busyItem === item.id} onClick={() => void changeQuantity(item.id, item.quantity + 1)} className="p-2 text-primary disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                    </div>
                    <button type="button" aria-label={`Remove ${item.product.name}`} disabled={busyItem === item.id} onClick={() => void removeItem(item.id)} className="p-2 text-error disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </article>
              )
            })}
          </div>
          <aside className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-md">
            <h2 className="font-title-md text-title-md font-semibold">Order Summary</h2>
            <div className="flex justify-between py-space-md border-b border-surface-container">
              <span>Subtotal</span><strong>{formatPrice(cart.subtotal)}</strong>
            </div>
            <p className="text-body-sm text-on-surface-variant mt-space-sm">Shipping and any applicable charges are confirmed at checkout.</p>
            <button type="button" onClick={onCheckout} className="w-full mt-space-md rounded-lg bg-primary px-space-md py-3 text-on-primary font-label-md font-bold hover:bg-primary-container">
              Continue to checkout
            </button>
          </aside>
        </div>
      ) : (
        <div className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-xl text-center">
          <ShoppingBag className="h-10 w-10 mx-auto text-outline" />
          <h2 className="font-title-md text-title-md font-semibold mt-space-sm">Your bag is empty</h2>
          <p className="text-body-md text-on-surface-variant mt-1">Browse the catalog and add products to get started.</p>
          <button type="button" onClick={onBrowse} className="mt-space-md rounded-lg bg-primary px-space-md py-2.5 text-on-primary font-label-md font-bold">Browse products</button>
        </div>
      )}
    </Container>
  )
}
