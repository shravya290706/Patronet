import { useEffect, useState } from "react"
import { PackageCheck } from "lucide-react"
import { Container } from "@/components/layout"
import { normalizeApiError } from "@/services/api.errors"
import { getOrder, getOrders } from "@/services/order.service"
import { getProductDetail } from "@/services/product.service"
import { formatPrice } from "@/lib/format-price"
import type { ApiOrderResponse } from "@/types/api.types"

interface OrdersPageProps {
  orderId?: string
  onBrowse?: () => void
}

function OrderSummary({ order }: { order: ApiOrderResponse }) {
  return (
    <article className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-md">
      <div className="flex flex-wrap justify-between gap-2">
        <div>
          <p className="font-label-md font-semibold">Order {order.order_number}</p>
          <p className="text-body-sm text-on-surface-variant">{new Date(order.created_at).toLocaleString()}</p>
        </div>
        <span className="rounded-full bg-primary-fixed px-3 py-1 text-label-sm text-primary capitalize">{order.status}</span>
      </div>
      <div className="mt-space-sm flex flex-wrap justify-between gap-2 border-t border-surface-container pt-space-sm">
        <span>{order.items.reduce((total, item) => total + item.quantity, 0)} item(s)</span>
        <strong>{formatPrice(order.total_amount)}</strong>
      </div>
      <p className="mt-1 text-body-sm text-on-surface-variant">
        Delivering to {order.delivery_address.full_name}, {order.delivery_address.city}, {order.delivery_address.state} {order.delivery_address.pincode}
      </p>
      <a href={`#order/${encodeURIComponent(order.id)}`} className="mt-space-sm inline-block text-primary font-label-sm hover:underline">View order details</a>
    </article>
  )
}

export function OrdersPage({ orderId, onBrowse }: OrdersPageProps) {
  const [orders, setOrders] = useState<ApiOrderResponse[]>([])
  const [selectedOrder, setSelectedOrder] = useState<ApiOrderResponse | null>(null)
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        if (orderId) {
          const order = await getOrder(orderId)
          if (!active) return
          setSelectedOrder(order)
          const entries = await Promise.all(
            order.items.map(async (item) => {
              try {
                const product = await getProductDetail(item.product_id)
                return [item.product_id, product.name] as const
              } catch {
                return [item.product_id, "Product details unavailable"] as const
              }
            })
          )
          if (active) setProductNames(Object.fromEntries(entries))
        } else {
          const response = await getOrders()
          if (active) setOrders(response.results)
        }
      } catch (rawError) {
        if (active) setError(normalizeApiError(rawError).message)
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [orderId])

  if (orderId) {
    return (
      <Container className="py-space-xl">
        {loading ? <p role="status" className="py-space-xl text-center">Loading order…</p> : error ? (
          <p role="alert" className="rounded-lg bg-error-container p-3 text-error">{error}</p>
        ) : selectedOrder ? (
          <div className="mx-auto max-w-3xl space-y-space-md">
            <div className="rounded-xl border border-primary/20 bg-primary-fixed/30 p-space-lg text-center">
              <PackageCheck className="mx-auto h-12 w-12 text-primary" />
              <h1 className="mt-space-sm font-headline-lg text-headline-lg text-primary font-bold">Order placed</h1>
              <p className="mt-1 text-body-md">Your order number is <strong>{selectedOrder.order_number}</strong>.</p>
              <p className="text-body-sm text-on-surface-variant">Payment is simulated. No payment details were collected.</p>
            </div>
            <article className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-md">
              <h2 className="font-title-md text-title-md font-semibold">Order details</h2>
              <div className="mt-space-sm divide-y divide-surface-container">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-3 py-3">
                    <span>{productNames[item.product_id] || "Product"} × {item.quantity}</span>
                    <strong>{formatPrice(item.subtotal)}</strong>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-surface-container pt-space-sm"><span>Total</span><strong>{formatPrice(selectedOrder.total_amount)}</strong></div>
              <div className="mt-space-md border-t border-surface-container pt-space-sm">
                <h3 className="font-label-md font-semibold">Delivery address</h3>
                <p className="text-body-sm">{selectedOrder.delivery_address.full_name}<br />{selectedOrder.delivery_address.address_line}<br />{selectedOrder.delivery_address.city}, {selectedOrder.delivery_address.state} {selectedOrder.delivery_address.pincode}</p>
              </div>
            </article>
            <div className="flex justify-center gap-space-sm">
              <a href="#orders" className="rounded-lg border border-primary px-space-md py-2.5 text-primary font-label-md font-bold">Order history</a>
              <button type="button" onClick={onBrowse} className="rounded-lg bg-primary px-space-md py-2.5 text-on-primary font-label-md font-bold">Continue shopping</button>
            </div>
          </div>
        ) : null}
      </Container>
    )
  }

  return (
    <Container className="py-space-xl">
      <h1 className="font-headline-lg text-headline-lg text-primary font-bold mb-space-lg">Your Orders</h1>
      {error && <p role="alert" className="mb-space-md rounded-lg bg-error-container p-3 text-error">{error}</p>}
      {loading ? <p role="status" className="py-space-xl text-center text-on-surface-variant">Loading orders…</p> : orders.length ? (
        <div className="space-y-space-sm">{orders.map((order) => <OrderSummary key={order.id} order={order} />)}</div>
      ) : (
        <div className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-xl text-center">
          <PackageCheck className="h-10 w-10 mx-auto text-outline" />
          <h2 className="font-title-md text-title-md font-semibold mt-space-sm">No orders yet</h2>
          <p className="text-body-md text-on-surface-variant mt-1">Completed orders will appear here.</p>
          <button type="button" onClick={onBrowse} className="mt-space-md rounded-lg bg-primary px-space-md py-2.5 text-on-primary font-label-md font-bold">Browse products</button>
        </div>
      )}
    </Container>
  )
}
