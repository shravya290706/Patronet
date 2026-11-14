import { useEffect, useState } from "react"
import {
  AlertCircle,
  CheckCircle2,
  MapPin,
  PackageCheck,
  ShieldAlert,
  Truck,
} from "lucide-react"
import { Container } from "@/components/layout"
import { formatPrice } from "@/lib/format-price"
import { normalizeApiError } from "@/services/api.errors"
import { getOrder, getOrders } from "@/services/order.service"
import { getProductDetail } from "@/services/product.service"
import type { ApiOrderResponse } from "@/types/api.types"

interface OrdersPageProps {
  orderId?: string
  onBrowse?: () => void
}

function getPaymentMethodDisplay(method?: string | null) {
  if (!method) return "Simulated Payment (Demo)"
  const lower = method.toLowerCase()
  if (lower === "gift_card") return "PATRONET Gift Card"
  if (lower === "upi") return "UPI (Demo Payment)"
  if (lower === "card") return "Credit / Debit Card (Demo)"
  if (lower === "emi") return "EMI (Demo Calculation)"
  if (lower === "cod") return "Cash on Delivery (Demo)"
  if (lower === "razorpay" || lower === "simulated") return "Simulated Payment (Demo)"
  return method.toUpperCase()
}

function getPaymentStatusBadge(status: string) {
  const norm = status.toLowerCase()
  if (norm === "paid") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
        <CheckCircle2 className="h-3 w-3" /> Paid
      </span>
    )
  }
  if (norm === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
        Pending
      </span>
    )
  }
  if (norm === "failed" || norm === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-error-container px-2.5 py-0.5 text-xs font-bold text-error">
        {status}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-0.5 text-xs font-bold text-on-surface-variant capitalize">
      {status}
    </span>
  )
}

function OrderSummaryCard({ order }: { order: ApiOrderResponse }) {
  return (
    <article className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-md shadow-xs hover:border-primary/40 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-container pb-space-sm">
        <div>
          <p className="font-label-md font-semibold text-on-surface">Order #{order.order_number}</p>
          <p className="text-body-sm text-on-surface-variant mt-0.5">
            {new Date(order.created_at).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {getPaymentStatusBadge(order.payment_status)}
          <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-xs font-bold text-primary capitalize">
            {order.status}
          </span>
        </div>
      </div>

      <div className="mt-space-sm flex flex-wrap items-center justify-between gap-2 text-body-sm">
        <div className="space-y-0.5">
          <p className="text-on-surface-variant">
            <span>{order.items.reduce((total, item) => total + item.quantity, 0)} item(s)</span>
            <span className="mx-1.5">•</span>
            <span>Method: <strong>{getPaymentMethodDisplay(order.payment_method)}</strong></span>
          </p>
          {order.gift_card_amount && Number(order.gift_card_amount) > 0 && (
            <p className="text-xs text-emerald-700 font-medium">
              Gift Card Applied: −{formatPrice(order.gift_card_amount)}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-on-surface-variant">Total Amount</p>
          <strong className="text-title-md text-primary">{formatPrice(order.total_amount)}</strong>
        </div>
      </div>

      <div className="mt-space-sm border-t border-surface-container pt-space-xs flex flex-wrap justify-between items-center text-xs text-on-surface-variant gap-2">
        <p className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>Deliver to {order.delivery_address.full_name}, {order.delivery_address.city}</span>
        </p>
        <a
          href={`#order/${encodeURIComponent(order.id)}`}
          className="text-primary font-label-sm font-semibold hover:underline"
        >
          View Order Details →
        </a>
      </div>
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

  // Single Order Details / Order Confirmation View
  if (orderId) {
    return (
      <Container className="py-space-xl">
        {loading ? (
          <p role="status" className="py-space-xl text-center text-on-surface-variant">Loading order…</p>
        ) : error ? (
          <div role="alert" className="rounded-lg bg-error-container p-space-md text-error flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-body-sm font-medium">{error}</p>
          </div>
        ) : selectedOrder ? (
          <div className="mx-auto max-w-3xl space-y-space-md">
            {/* Demo Notice */}
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
              <ShieldAlert className="h-4 w-4 text-amber-700 shrink-0" />
              <span>
                <strong>PATRONET Demo – Test Transaction Only:</strong> This simulated order was processed with ₹0 charged.
              </span>
            </div>

            {/* Confirmation Banner */}
            <div className="rounded-2xl border border-primary/20 bg-primary-fixed/25 p-space-lg text-center shadow-xs">
              <PackageCheck className="mx-auto h-12 w-12 text-primary" />
              <h1 className="mt-space-sm font-headline-lg text-headline-lg text-primary font-bold">
                Order Placed Successfully!
              </h1>
              <p className="mt-1 text-body-md text-on-surface">
                Thank you for your order. Your order number is <strong>{selectedOrder.order_number}</strong>.
              </p>
              <div className="mt-space-sm flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-full bg-surface-container-lowest border border-surface-container px-3 py-1 text-xs font-semibold text-on-surface">
                  Payment Status: {getPaymentStatusBadge(selectedOrder.payment_status)}
                </span>
                <span className="rounded-full bg-surface-container-lowest border border-surface-container px-3 py-1 text-xs font-semibold text-on-surface">
                  Method: {getPaymentMethodDisplay(selectedOrder.payment_method)}
                </span>
              </div>
            </div>

            {/* Estimated Delivery Banner */}
            <div className="flex items-center gap-3 rounded-xl border border-surface-container bg-surface-container-lowest p-space-md shadow-xs">
              <Truck className="h-6 w-6 text-primary shrink-0" />
              <div>
                <p className="font-semibold text-body-sm text-on-surface">Estimated Delivery</p>
                <p className="text-body-sm text-on-surface-variant">
                  Expected to arrive within <strong>3 to 5 business days</strong> at your delivery address.
                </p>
              </div>
            </div>

            {/* Order Items & Breakdown */}
            <article className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-md shadow-xs">
              <h2 className="font-title-md text-title-md font-semibold text-on-surface border-b border-surface-container pb-space-xs">
                Purchased Items ({selectedOrder.items.reduce((tot, i) => tot + i.quantity, 0)})
              </h2>
              <div className="mt-space-sm divide-y divide-surface-container">
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between items-center gap-3 py-3 text-body-sm">
                    <div>
                      <p className="font-semibold text-on-surface">{productNames[item.product_id] || "Product"}</p>
                      <p className="text-xs text-on-surface-variant">Qty: {item.quantity} × {formatPrice(item.unit_price)}</p>
                    </div>
                    <strong className="text-on-surface">{formatPrice(item.subtotal)}</strong>
                  </div>
                ))}
              </div>

              {/* Payment Breakdown */}
              <div className="mt-space-md border-t border-surface-container pt-space-sm space-y-2 text-body-sm">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Subtotal</span>
                  <span>{formatPrice(selectedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-on-surface-variant">
                  <span>Delivery Charges</span>
                  <span className="text-emerald-700 font-semibold">FREE</span>
                </div>
                {selectedOrder.gift_card_amount && Number(selectedOrder.gift_card_amount) > 0 && (
                  <div className="flex justify-between text-emerald-800 font-medium">
                    <span>PATRONET Gift Card ({selectedOrder.gift_card_code || "Redeemed"})</span>
                    <span>−{formatPrice(selectedOrder.gift_card_amount)}</span>
                  </div>
                )}
                {selectedOrder.payable_amount !== null && selectedOrder.payable_amount !== undefined && (
                  <div className="flex justify-between text-on-surface-variant">
                    <span>Paid via Gateway</span>
                    <span>{formatPrice(selectedOrder.payable_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-dashed border-surface-container pt-2 text-title-md font-bold text-on-surface">
                  <span>Total Paid</span>
                  <span className="text-primary">{formatPrice(selectedOrder.total_amount)}</span>
                </div>
              </div>

              {/* Transaction Reference */}
              {selectedOrder.razorpay_payment_id && (
                <div className="mt-space-md rounded bg-surface-container-low p-2 text-xs font-mono text-on-surface-variant">
                  <span>Razorpay Payment Ref: <strong>{selectedOrder.razorpay_payment_id}</strong></span>
                </div>
              )}

              {/* Delivery Address Details */}
              <div className="mt-space-md border-t border-surface-container pt-space-sm">
                <h3 className="font-label-md font-semibold text-on-surface flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-primary" /> Delivery Address
                </h3>
                <p className="text-body-sm text-on-surface mt-1 leading-relaxed">
                  <strong>{selectedOrder.delivery_address.full_name}</strong> ({selectedOrder.delivery_address.phone})<br />
                  {selectedOrder.delivery_address.address_line}<br />
                  {selectedOrder.delivery_address.city}, {selectedOrder.delivery_address.state} – {selectedOrder.delivery_address.pincode}
                </p>
              </div>
            </article>

            {/* Bottom Actions */}
            <div className="flex justify-center gap-space-sm pt-2">
              <a
                href="#orders"
                className="rounded-lg border border-primary px-space-md py-2.5 text-primary font-label-md font-bold hover:bg-primary-fixed/20 transition-colors"
              >
                View All Orders
              </a>
              <button
                type="button"
                onClick={onBrowse}
                className="rounded-lg bg-primary px-space-md py-2.5 text-on-primary font-label-md font-bold hover:bg-primary/90 transition-colors shadow-sm"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        ) : null}
      </Container>
    )
  }

  // Orders List View
  return (
    <Container className="py-space-xl">
      <div className="mb-space-md flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-primary font-bold">Your Orders</h1>
          <p className="font-body-md text-on-surface-variant mt-0.5">
            Review past orders, payment receipts, and delivery tracking.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-space-md rounded-lg bg-error-container p-3 text-error flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-body-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <p role="status" className="py-space-xl text-center text-on-surface-variant">Loading orders…</p>
      ) : orders.length ? (
        <div className="space-y-space-sm">
          {orders.map((order) => (
            <OrderSummaryCard key={order.id} order={order} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-xl text-center">
          <PackageCheck className="h-12 w-12 mx-auto text-outline" />
          <h2 className="font-title-md text-title-md font-semibold mt-space-sm text-on-surface">No orders yet</h2>
          <p className="text-body-md text-on-surface-variant mt-1">Completed orders will appear here.</p>
          <button
            type="button"
            onClick={onBrowse}
            className="mt-space-md rounded-lg bg-primary px-space-md py-2.5 text-on-primary font-label-md font-bold shadow-sm hover:bg-primary/90 transition-colors"
          >
            Browse Products
          </button>
        </div>
      )}
    </Container>
  )
}
