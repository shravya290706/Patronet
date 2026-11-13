import { useEffect, useState } from "react"
import { MapPin, ShieldCheck } from "lucide-react"
import { Container } from "@/components/layout"
import { normalizeApiError } from "@/services/api.errors"
import { getAddresses } from "@/services/address.service"
import { getCart } from "@/services/cart.service"
import { checkoutOrder } from "@/services/order.service"
import { formatPrice } from "@/lib/format-price"
import type { ApiAddress, ApiCartResponse, ApiOrderResponse } from "@/types/api.types"

interface CheckoutPageProps {
  onManageAddresses?: () => void
  onOrderPlaced?: (order: ApiOrderResponse) => void
  onBrowse?: () => void
}

export function CheckoutPage({ onManageAddresses, onOrderPlaced, onBrowse }: CheckoutPageProps) {
  const [cart, setCart] = useState<ApiCartResponse | null>(null)
  const [addresses, setAddresses] = useState<ApiAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState("")
  const [loading, setLoading] = useState(true)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function loadCheckout() {
      try {
        const [cartResponse, addressResponse] = await Promise.all([getCart(), getAddresses()])
        if (!active) return
        setCart(cartResponse)
        setAddresses(addressResponse)
        setSelectedAddressId(
          addressResponse.find((address) => address.is_default)?.id ??
            addressResponse[0]?.id ??
            ""
        )
      } catch (rawError) {
        if (active) setError(normalizeApiError(rawError).message)
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadCheckout()
    return () => {
      active = false
    }
  }, [])

  const placeOrder = async () => {
    if (!selectedAddressId) {
      setError("Choose a delivery address before placing your order.")
      return
    }
    setPlacingOrder(true)
    setError(null)
    try {
      const order = await checkoutOrder({ address_id: selectedAddressId })
      onOrderPlaced?.(order)
    } catch (rawError) {
      setError(normalizeApiError(rawError).message)
    } finally {
      setPlacingOrder(false)
    }
  }

  return (
    <Container className="py-space-xl">
      <h1 className="font-headline-lg text-headline-lg text-primary font-bold">Checkout</h1>
      <p className="font-body-md text-body-md text-on-surface-variant mt-1 mb-space-lg">Review your delivery address and order.</p>
      {error && <p role="alert" className="mb-space-md rounded-lg bg-error-container p-3 text-error">{error}</p>}

      {loading ? (
        <p role="status" className="py-space-xl text-center text-on-surface-variant">Loading checkout…</p>
      ) : !cart?.items.length ? (
        <div className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-xl text-center">
          <h2 className="font-title-md text-title-md font-semibold">Your bag is empty</h2>
          <button type="button" onClick={onBrowse} className="mt-space-md rounded-lg bg-primary px-space-md py-2.5 text-on-primary font-label-md font-bold">Browse products</button>
        </div>
      ) : (
        <div className="grid gap-gutter lg:grid-cols-[1fr_340px] items-start">
          <section className="space-y-space-md">
            <div className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-md">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-title-md text-title-md font-semibold">Delivery address</h2>
                <button type="button" onClick={onManageAddresses} className="text-primary font-label-sm hover:underline">Manage addresses</button>
              </div>
              {addresses.length ? (
                <div className="mt-space-sm space-y-space-sm">
                  {addresses.map((address) => (
                    <label key={address.id} className={`flex gap-3 rounded-lg border p-space-sm cursor-pointer ${selectedAddressId === address.id ? "border-primary bg-primary-fixed/30" : "border-surface-container"}`}>
                      <input type="radio" name="delivery-address" value={address.id} checked={selectedAddressId === address.id} onChange={() => setSelectedAddressId(address.id)} />
                      <span>
                        <span className="flex items-center gap-1 font-label-md font-semibold"><MapPin className="h-4 w-4 text-primary" />{address.full_name}{address.is_default ? " · Default" : ""}</span>
                        <span className="block text-body-sm mt-1">{address.address_line_1}{address.address_line_2 ? `, ${address.address_line_2}` : ""}, {address.city}, {address.state} {address.pincode}</span>
                        <span className="block text-body-sm text-on-surface-variant">{address.phone}</span>
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mt-space-md rounded-lg bg-surface-container-low p-space-md text-center">
                  <p className="text-body-md">Add a delivery address to continue.</p>
                  <button type="button" onClick={onManageAddresses} className="mt-space-sm rounded-lg bg-primary px-space-md py-2 text-on-primary font-label-md font-bold">Add address</button>
                </div>
              )}
            </div>
            <div className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-md">
              <h2 className="font-title-md text-title-md font-semibold">Payment</h2>
              <p className="mt-1 text-body-sm text-on-surface-variant">Payment is simulated for this project. No card or CVV information is collected.</p>
              <p className="mt-space-sm inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-3 py-2 text-label-sm"><ShieldCheck className="h-4 w-4 text-primary" />Simulated payment</p>
            </div>
          </section>

          <aside className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-md">
            <h2 className="font-title-md text-title-md font-semibold">Order Summary</h2>
            <div className="my-space-sm space-y-3">
              {cart.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-3 text-body-sm">
                  <span>{item.product.name} × {item.quantity}</span><strong>{formatPrice(item.subtotal)}</strong>
                </div>
              ))}
            </div>
            <div className="flex justify-between border-t border-surface-container pt-space-sm"><span>Subtotal</span><strong>{formatPrice(cart.subtotal)}</strong></div>
            <button type="button" disabled={placingOrder || !selectedAddressId} onClick={() => void placeOrder()} className="w-full mt-space-md rounded-lg bg-primary px-space-md py-3 text-on-primary font-label-md font-bold disabled:opacity-50">
              {placingOrder ? "Placing order…" : "Place order"}
            </button>
          </aside>
        </div>
      )}
    </Container>
  )
}
