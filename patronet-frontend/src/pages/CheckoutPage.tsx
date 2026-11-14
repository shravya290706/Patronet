import { useEffect, useState } from "react"
import {
  AlertCircle,
  Banknote,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  Info,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Truck,
} from "lucide-react"
import { Container } from "@/components/layout"
import { formatPrice } from "@/lib/format-price"
import { getAddresses } from "@/services/address.service"
import { normalizeApiError } from "@/services/api.errors"
import { getCart } from "@/services/cart.service"
import { checkoutOrder } from "@/services/order.service"
import { getDemoGiftCards, validateGiftCard } from "@/services/payment.service"
import type {
  ApiAddress,
  ApiCartResponse,
  ApiDemoGiftCard,
  ApiGiftCardValidateResponse,
  ApiOrderResponse,
} from "@/types/api.types"

interface CheckoutPageProps {
  onManageAddresses?: () => void
  onOrderPlaced?: (order: ApiOrderResponse) => void
  onBrowse?: () => void
}

type PaymentMethodType = "upi" | "card" | "emi" | "gift_card" | "cod"
type UpiAppType = "gpay" | "phonepe" | "paytm" | "bhim" | "custom_vpa"
type CardNetworkType = "visa" | "mastercard" | "rupay"

interface CardFormData {
  cardNumber: string
  cardholderName: string
  expiryMonth: string
  expiryYear: string
  cvv: string
}

function generateDemoOrderNumber(): string {
  const token = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8).toUpperCase()
    : "DEMO88"
  return `DEMO-PAT-${token}`
}

function generateDemoOrderId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? `demo-${crypto.randomUUID()}`
    : `demo-${String(Date.now())}`
}

export function CheckoutPage({
  onManageAddresses,
  onOrderPlaced,
  onBrowse,
}: CheckoutPageProps) {
  // Core Checkout Data State
  const [cart, setCart] = useState<ApiCartResponse | null>(null)
  const [orderCartSnapshot, setOrderCartSnapshot] = useState<ApiCartResponse | null>(null)
  const [addresses, setAddresses] = useState<ApiAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  // Payment Selection State
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType>("upi")

  // UPI State
  const [selectedUpiApp, setSelectedUpiApp] = useState<UpiAppType>("gpay")
  const [customVpa, setCustomVpa] = useState("patronet.demo@okhdfcbank")

  // Card Form State
  const [cardData, setCardData] = useState<CardFormData>({
    cardNumber: "4532 •••• •••• 8821",
    cardholderName: "PATRONET TEST CUSTOMER",
    expiryMonth: "09",
    expiryYear: "28",
    cvv: "•••",
  })
  const [cardNetwork, setCardNetwork] = useState<CardNetworkType>("visa")

  // EMI State
  const [selectedEmiMonths, setSelectedEmiMonths] = useState<number>(6)

  // Gift Card State
  const [giftCardInput, setGiftCardInput] = useState("")
  const [appliedGiftCard, setAppliedGiftCard] = useState<ApiGiftCardValidateResponse | null>(null)
  const [validatingGiftCard, setValidatingGiftCard] = useState(false)
  const [giftCardMessage, setGiftCardMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [demoCards, setDemoCards] = useState<ApiDemoGiftCard[]>([])

  // Order Execution & Simulation State
  const [isProcessing, setIsProcessing] = useState(false)
  const [simulationStep, setSimulationStep] = useState<string | null>(null)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [confirmedOrder, setConfirmedOrder] = useState<ApiOrderResponse | null>(null)

  // Local Demo Checkout Safeguard:
  // Strictly restricted to local development (import.meta.env.DEV) and active by default.
  // In production builds, this is strictly false and cannot be enabled.
  const isDemoMode =
    Boolean(import.meta.env.DEV) &&
    import.meta.env.VITE_DEMO_CHECKOUT !== "false"

  // Load initial cart, addresses, and demo gift cards
  useEffect(() => {
    let active = true

    async function loadData() {
      try {
        const [cartRes, addressRes, demoCardsRes] = await Promise.all([
          getCart(),
          getAddresses(),
          getDemoGiftCards().catch(() => []),
        ])

        if (!active) return
        setCart(cartRes)
        setOrderCartSnapshot(cartRes)
        setAddresses(addressRes)
        setDemoCards(demoCardsRes)

        const defaultAddr = addressRes.find((a) => a.is_default) || addressRes[0]
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id)
        }
      } catch (err) {
        if (active) setPageError(normalizeApiError(err).message)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadData()
    return () => {
      active = false
    }
  }, [])

  // Price & Deduction Calculations
  const cartSubtotalNum = Number(cart?.subtotal || "0")
  const deliveryCharge = cartSubtotalNum > 0 && cartSubtotalNum < 500 ? 40 : 0
  const grossTotal = cartSubtotalNum + deliveryCharge

  const giftCardDeduction = appliedGiftCard ? Math.min(Number(appliedGiftCard.applicable_amount), grossTotal) : 0
  const netPayable = Math.max(0, grossTotal - giftCardDeduction)
  const isFullyCoveredByGiftCard = appliedGiftCard !== null && netPayable === 0

  // Handle gift card application
  const handleApplyGiftCard = async (codeToApply?: string) => {
    const code = (codeToApply || giftCardInput).trim().toUpperCase()
    if (!code) {
      setGiftCardMessage({ type: "error", text: "Please enter a voucher code." })
      return
    }

    setValidatingGiftCard(true)
    setGiftCardMessage(null)

    try {
      const res = await validateGiftCard({
        code,
        cart_subtotal: grossTotal,
      })

      if (res.valid) {
        setAppliedGiftCard(res)
        setGiftCardInput(res.code)
        const deduction = Math.min(Number(res.applicable_amount), grossTotal)
        if (grossTotal - deduction <= 0) {
          setSelectedPaymentMethod("gift_card")
        }
        setGiftCardMessage({
          type: "success",
          text: `Voucher ${res.code} applied! ₹${Number(res.applicable_amount).toFixed(2)} deducted.`,
        })
      } else {
        setAppliedGiftCard(null)
        setGiftCardMessage({ type: "error", text: res.message || "Invalid voucher code." })
      }
    } catch (err) {
      setAppliedGiftCard(null)
      setGiftCardMessage({ type: "error", text: normalizeApiError(err).message })
    } finally {
      setValidatingGiftCard(false)
    }
  }

  const handleRemoveGiftCard = () => {
    setAppliedGiftCard(null)
    setGiftCardInput("")
    setGiftCardMessage(null)
    if (selectedPaymentMethod === "gift_card") {
      setSelectedPaymentMethod("upi")
    }
  }

  // Handle Card Form formatting
  const handleCardNumberChange = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 16)
    const formatted = digits.replace(/(\d{4})(?=\d)/g, "$1 ")
    setCardData((prev) => ({ ...prev, cardNumber: formatted }))

    if (digits.startsWith("4")) setCardNetwork("visa")
    else if (digits.startsWith("5") || digits.startsWith("2")) setCardNetwork("mastercard")
    else if (digits.startsWith("6") || digits.startsWith("8")) setCardNetwork("rupay")
  }

  // Final Order Placement Handler
  const handlePlaceOrder = async () => {
    if (isProcessing || isSubmitted || confirmedOrder) return
    if (!selectedAddressId) {
      setPageError("Please select a delivery address before proceeding.")
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    setPageError(null)
    setIsProcessing(true)

    // Step 1: Realistic simulation step message
    let stepMsg = "Simulating secure payment authentication…"
    if (selectedPaymentMethod === "upi") {
      stepMsg = `Simulating UPI authorization via ${selectedUpiApp.toUpperCase()} (Demo)…`
    } else if (selectedPaymentMethod === "card") {
      stepMsg = "Simulating bank 3D-Secure demo verification…"
    } else if (selectedPaymentMethod === "emi") {
      stepMsg = `Calculating illustrative ${selectedEmiMonths}-month demo instalment plan…`
    } else if (selectedPaymentMethod === "gift_card") {
      stepMsg = "Redeeming PATRONET voucher balance…"
    } else if (selectedPaymentMethod === "cod") {
      stepMsg = "Validating Cash on Delivery order eligibility…"
    }

    setSimulationStep(stepMsg)

    try {
      // 1-second interactive delay to show clean processing feedback
      await new Promise((resolve) => setTimeout(resolve, 1000))

      if (isDemoMode) {
        // ── SAFE LOCAL DEMO MODE: NEVER invoke checkoutOrder() or POST /api/orders/checkout ──
        // Synthesizes an authentic ApiOrderResponse in memory without altering Aiven PostgreSQL, cart, or inventory.
        const demoOrderNumber = generateDemoOrderNumber()
        const demoOrderId = generateDemoOrderId()

        const simulatedOrder: ApiOrderResponse = {
          id: demoOrderId,
          order_number: demoOrderNumber,
          status: "placed",
          payment_status: selectedPaymentMethod === "cod" ? "pending" : "paid",
          payment_method: isFullyCoveredByGiftCard ? "gift_card" : selectedPaymentMethod,
          address_id: selectedAddressId,
          delivery_address: {
            full_name: selectedAddress?.full_name || "Demo Customer",
            phone: selectedAddress?.phone || "9876543210",
            address_line: selectedAddress?.address_line_1 || "Demo Street",
            city: selectedAddress?.city || "Demo City",
            state: selectedAddress?.state || "Demo State",
            pincode: selectedAddress?.pincode || "560001",
          },
          items: cartItems.map((ci) => ({
            id: `demo-item-${ci.id}`,
            product_id: ci.product.id,
            store_id: "demo-store-001",
            quantity: ci.quantity,
            unit_price: ci.unit_price,
            subtotal: ci.subtotal,
          })),
          subtotal: cartSubtotalNum.toString(),
          total_amount: grossTotal.toString(),
          gift_card_code: appliedGiftCard?.code || null,
          gift_card_amount: giftCardDeduction > 0 ? giftCardDeduction.toString() : "0.00",
          payable_amount: netPayable.toString(),
          created_at: new Date().toISOString(),
        }

        // Store confirmed demo order in frontend memory
        setConfirmedOrder(simulatedOrder)
        setIsSubmitted(true)
        setIsProcessing(false)
        setSimulationStep(null)
        window.scrollTo({ top: 0, behavior: "smooth" })

        // Notify parent app
        onOrderPlaced?.(simulatedOrder)
        return
      }

      // ── REAL BACKEND CHECKOUT (Only when Demo Mode is explicitly disabled) ──
      const createdOrder = await checkoutOrder({
        address_id: selectedAddressId,
        payment_method: isFullyCoveredByGiftCard ? "gift_card" : selectedPaymentMethod,
        gift_card_code: appliedGiftCard?.code || null,
        gift_card_amount: giftCardDeduction > 0 ? giftCardDeduction : null,
      })

      // Backend order successfully created
      setConfirmedOrder(createdOrder)
      setIsSubmitted(true)
      setIsProcessing(false)
      setSimulationStep(null)
      window.scrollTo({ top: 0, behavior: "smooth" })

      // Notify parent app
      onOrderPlaced?.(createdOrder)
    } catch (err) {
      const normalized = normalizeApiError(err)
      let displayError = normalized.message
      if (
        normalized.status === 0 ||
        normalized.message.toLowerCase().includes("failed to fetch") ||
        normalized.message.toLowerCase().includes("unable to connect")
      ) {
        displayError =
          "Unable to connect to the backend server (http://127.0.0.1:8000). Please ensure the FastAPI backend is running and try again."
      }
      setPageError(displayError)
      setIsProcessing(false)
      setSimulationStep(null)
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }

  if (loading) {
    return (
      <Container className="py-space-xl">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary mb-3" />
          <h2 className="font-title-md font-semibold text-primary">Preparing Secure Demo Checkout…</h2>
          <p className="text-body-sm text-outline mt-1">Loading saved addresses and shopping cart items</p>
        </div>
      </Container>
    )
  }

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId)
  const cartItems = cart?.items || []

  // ── ORDER CONFIRMATION VIEW (Displayed immediately upon successful backend order creation) ──
  if (confirmedOrder) {
    const confirmationAddress = confirmedOrder.delivery_address
    const paymentMethodDisplay =
      confirmedOrder.payment_method === "upi"
        ? `UPI Demo (${selectedUpiApp.toUpperCase()})`
        : confirmedOrder.payment_method === "card"
        ? `Credit/Debit Card Demo (${cardNetwork.toUpperCase()} •••• ${cardData.cardNumber.slice(-4)})`
        : confirmedOrder.payment_method === "emi"
        ? `EMI Demo (${selectedEmiMonths} Months)`
        : confirmedOrder.payment_method === "gift_card"
        ? `PATRONET Gift Card (${confirmedOrder.gift_card_code || "Redeemed"})`
        : confirmedOrder.payment_method === "cod"
        ? "Cash on Delivery (COD Demo)"
        : "Simulated Payment (Demo)"

    const confirmedItems = orderCartSnapshot?.items || []

    return (
      <div className="bg-[#F8FAFC] min-h-[calc(100vh-120px)] py-space-lg sm:py-space-xl">
        <Container className="max-w-4xl">
          <div className="space-y-space-md">
            {/* Success Header Banner */}
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-surface-container-lowest p-space-lg sm:p-space-xl text-center shadow-xs">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h1 className="mt-space-md font-headline-lg font-bold text-primary">
                Order Placed Successfully
              </h1>
              <p className="mt-1 text-body-md text-on-surface">
                Thank you for testing PATRONET.
              </p>
              <div className="mt-space-sm inline-flex items-center gap-2 rounded-full border border-surface-container bg-surface-container-lowest px-4 py-1.5 shadow-2xs">
                <span className="text-xs font-semibold text-outline">Order Reference:</span>
                <span className="font-mono text-sm font-bold text-primary">{confirmedOrder.order_number}</span>
              </div>
            </div>

            {/* Delivery & Payment Badges Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
              {/* Delivery Details */}
              <div className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-md shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-outline">
                  <Truck className="h-4 w-4 text-primary" />
                  <span>Delivery Destination</span>
                </div>
                <p className="text-sm font-bold text-on-surface">{confirmationAddress.full_name}</p>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  {confirmationAddress.address_line}<br />
                  {confirmationAddress.city}, {confirmationAddress.state} – {confirmationAddress.pincode}<br />
                  Phone: {confirmationAddress.phone}
                </p>
                <div className="pt-2 border-t border-surface-container text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Estimated Delivery: 2–4 business days</span>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-md shadow-2xs space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-outline">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <span>Payment Summary</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-on-surface-variant">Method:</span>
                  <span className="font-bold text-on-surface">{paymentMethodDisplay}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-on-surface-variant">Payment Status:</span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                    {confirmedOrder.payment_status === "paid" ? "Paid (Demo Simulation)" : "Pending (COD Demo)"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-surface-container">
                  <span className="font-bold text-primary">Total Amount:</span>
                  <span className="text-headline-sm font-bold text-primary">{formatPrice(confirmedOrder.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Purchased Items List */}
            <div className="rounded-xl border border-surface-container bg-surface-container-lowest p-space-md shadow-2xs">
              <h3 className="font-title-md font-bold text-on-surface pb-3 border-b border-surface-container">
                Ordered Products ({confirmedItems.length > 0 ? confirmedItems.reduce((acc, i) => acc + i.quantity, 0) : confirmedOrder.items.reduce((acc, i) => acc + i.quantity, 0)} items)
              </h3>
              <div className="divide-y divide-surface-container/60 mt-2">
                {confirmedItems.length > 0 ? (
                  confirmedItems.map((item) => {
                    const itemImg = item.product.primary_image?.image_url || item.product.images?.[0]?.image_url
                    return (
                      <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {itemImg && (
                            <img
                              src={itemImg}
                              alt={item.product.name}
                              className="h-12 w-12 rounded-lg object-contain bg-surface-container-low p-1 border border-surface-container"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-on-surface truncate">{item.product.name}</p>
                            <p className="text-xs text-outline">Qty: {item.quantity} × {formatPrice(item.unit_price)}</p>
                          </div>
                        </div>
                        <span className="font-bold text-sm text-on-surface shrink-0">{formatPrice(item.subtotal)}</span>
                      </div>
                    )
                  })
                ) : (
                  confirmedOrder.items.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-semibold text-sm text-on-surface">Product SKU Item</p>
                        <p className="text-xs text-outline">Qty: {item.quantity} × {formatPrice(item.unit_price)}</p>
                      </div>
                      <span className="font-bold text-sm text-on-surface shrink-0">{formatPrice(item.subtotal)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Navigation Action Buttons */}
            <div className="pt-space-md flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="#orders"
                className="w-full sm:w-auto rounded-xl border border-primary px-6 py-3 text-center text-primary font-label-md font-bold hover:bg-primary-fixed/20 transition-colors shadow-2xs"
              >
                View All Orders
              </a>
              <button
                type="button"
                onClick={onBrowse}
                className="w-full sm:w-auto rounded-xl bg-primary px-8 py-3 text-center text-on-primary font-label-md font-bold hover:bg-primary/90 transition-colors shadow-xs"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </Container>
      </div>
    )
  }

  if (cartItems.length === 0 && !isSubmitted) {
    return (
      <Container className="py-space-xl">
        <div className="max-w-md mx-auto text-center rounded-2xl border border-surface-container bg-surface-container-lowest p-space-xl shadow-xs">
          <Info className="h-12 w-12 text-primary mx-auto mb-3" />
          <h1 className="font-headline-md font-bold text-primary">Your Cart is Empty</h1>
          <p className="text-body-md text-outline mt-2">
            Add items to your cart before proceeding to checkout.
          </p>
          <button
            type="button"
            onClick={onBrowse}
            className="mt-space-md w-full rounded-xl bg-primary px-space-md py-3 text-on-primary font-label-md font-bold shadow-xs hover:bg-primary/90 transition-colors"
          >
            Browse Marketplace Catalog
          </button>
        </div>
      </Container>
    )
  }

  return (
    <div className="bg-[#F8FAFC] min-h-[calc(100vh-120px)] py-space-lg sm:py-space-xl">
      <Container>
        {/* Checkout Header Banner */}
        <div className="mb-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-space-sm border-b border-surface-container">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-headline-lg font-bold text-primary tracking-tight">Checkout</h1>
              {isDemoMode && (
                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 border border-emerald-200 uppercase tracking-wider">
                  Demo Mode
                </span>
              )}
            </div>
            <p className="font-body-sm text-outline mt-0.5">
              Review your delivery address and choose your payment method.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-outline bg-surface-container-lowest px-3 py-1.5 rounded-lg border border-surface-container shadow-2xs">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Secure Checkout</span>
          </div>
        </div>

        {/* Global Page Error */}
        {pageError && (
          <div role="alert" className="mb-space-md rounded-xl bg-error-container/20 border border-error/30 p-space-md text-error flex items-start gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-body-sm font-medium">
              <p className="font-bold">Checkout Notice</p>
              <p>{pageError}</p>
            </div>
          </div>
        )}

        {/* 2-Column Desktop Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
          {/* LEFT COLUMN: Steps 1 & 2 (8 cols on lg) */}
          <div className="lg:col-span-8 space-y-space-md">
            {/* ── STEP 1: DELIVERY ADDRESS ────────────────────────────────────────── */}
            <section aria-labelledby="step-address-heading" className="rounded-2xl border border-surface-container bg-surface-container-lowest p-space-md sm:p-space-lg shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-surface-container">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary font-bold text-xs">
                    1
                  </span>
                  <h2 id="step-address-heading" className="font-title-md font-bold text-primary">
                    Delivery Address
                  </h2>
                </div>

                {onManageAddresses && (
                  <button
                    type="button"
                    onClick={onManageAddresses}
                    className="inline-flex items-center gap-1 font-label-sm font-bold text-primary hover:text-secondary-container transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add / Manage Addresses</span>
                  </button>
                )}
              </div>

              {addresses.length === 0 ? (
                <div className="py-6 text-center">
                  <MapPin className="h-8 w-8 text-outline mx-auto mb-2" />
                  <p className="text-body-sm text-on-surface-variant font-medium">No saved addresses found.</p>
                  <button
                    type="button"
                    onClick={onManageAddresses}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90 transition-colors shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add New Delivery Address</span>
                  </button>
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id
                    return (
                      <div
                        key={addr.id}
                        onClick={() => setSelectedAddressId(addr.id)}
                        className={`relative rounded-xl p-3.5 border transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? "border-primary bg-primary-fixed/20 shadow-xs"
                            : "border-surface-container bg-surface-container-low hover:border-outline hover:bg-surface-container-lowest"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-label-md font-bold text-on-surface truncate">
                              {addr.full_name}
                            </span>
                            <div className="flex items-center gap-1">
                              {addr.is_default && (
                                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary uppercase">
                                  Default
                                </span>
                              )}
                              <span className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-bold text-outline uppercase">
                                {addr.label || "Home"}
                              </span>
                            </div>
                          </div>

                          <p className="text-body-xs text-on-surface-variant leading-relaxed">
                            {addr.address_line_1}
                            {addr.address_line_2 ? `, ${addr.address_line_2}` : ""}
                            <br />
                            {addr.city}, {addr.state} — {addr.pincode}
                          </p>
                          <p className="text-body-xs font-semibold text-outline mt-1.5">
                            Phone: {addr.phone}
                          </p>
                        </div>

                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-surface-container/60">
                          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-primary">
                            <input
                              type="radio"
                              name="delivery_address"
                              checked={isSelected}
                              onChange={() => setSelectedAddressId(addr.id)}
                              className="accent-primary h-3.5 w-3.5"
                            />
                            <span>{isSelected ? "Deliver to this address" : "Select address"}</span>
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ── STEP 2: PAYMENT METHOD SELECTION ─────────────────────────────────── */}
            <section aria-labelledby="step-payment-heading" className="rounded-2xl border border-surface-container bg-surface-container-lowest p-space-md sm:p-space-lg shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-surface-container">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary font-bold text-xs">
                    2
                  </span>
                  <div>
                    <h2 id="step-payment-heading" className="font-title-md font-bold text-primary">
                      Payment Options
                    </h2>
                    <p className="text-[11px] text-outline">
                      Interactive mock payment simulation • No actual card or banking transactions
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  <Lock className="h-3 w-3" /> Sandbox Mode
                </span>
              </div>

              {/* Payment Method Selector Tabs */}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
                {/* 1. UPI */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod("upi")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    selectedPaymentMethod === "upi"
                      ? "border-primary bg-primary-fixed/20 text-primary font-bold shadow-2xs"
                      : "border-surface-container bg-surface-container-low text-on-surface-variant hover:border-outline"
                  }`}
                >
                  <Smartphone className="h-5 w-5 mb-1 text-primary" />
                  <span className="text-xs">UPI</span>
                  <span className="text-[10px] text-outline font-normal">GPay / PhonePe</span>
                </button>

                {/* 2. Credit / Debit Card */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod("card")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    selectedPaymentMethod === "card"
                      ? "border-primary bg-primary-fixed/20 text-primary font-bold shadow-2xs"
                      : "border-surface-container bg-surface-container-low text-on-surface-variant hover:border-outline"
                  }`}
                >
                  <CreditCard className="h-5 w-5 mb-1 text-primary" />
                  <span className="text-xs">Card</span>
                  <span className="text-[10px] text-outline font-normal">Visa / Master / RuPay</span>
                </button>

                {/* 3. EMI */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod("emi")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    selectedPaymentMethod === "emi"
                      ? "border-primary bg-primary-fixed/20 text-primary font-bold shadow-2xs"
                      : "border-surface-container bg-surface-container-low text-on-surface-variant hover:border-outline"
                  }`}
                >
                  <Clock className="h-5 w-5 mb-1 text-primary" />
                  <span className="text-xs">EMI</span>
                  <span className="text-[10px] text-outline font-normal">3 - 12 Months</span>
                </button>

                {/* 4. Gift Cards */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod("gift_card")}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    selectedPaymentMethod === "gift_card"
                      ? "border-primary bg-primary-fixed/20 text-primary font-bold shadow-2xs"
                      : "border-surface-container bg-surface-container-low text-on-surface-variant hover:border-outline"
                  }`}
                >
                  <Gift className="h-5 w-5 mb-1 text-primary" />
                  <span className="text-xs">Gift Card</span>
                  <span className="text-[10px] text-outline font-normal">PATRONET Voucher</span>
                </button>

                {/* 5. Cash on Delivery */}
                <button
                  type="button"
                  onClick={() => setSelectedPaymentMethod("cod")}
                  className={`col-span-2 sm:col-span-1 flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                    selectedPaymentMethod === "cod"
                      ? "border-primary bg-primary-fixed/20 text-primary font-bold shadow-2xs"
                      : "border-surface-container bg-surface-container-low text-on-surface-variant hover:border-outline"
                  }`}
                >
                  <Banknote className="h-5 w-5 mb-1 text-primary" />
                  <span className="text-xs">COD</span>
                  <span className="text-[10px] text-outline font-normal">Pay on Delivery</span>
                </button>
              </div>

              {/* PAYMENT OPTION DETAILS PANEL */}
              <div className="mt-4 rounded-xl border border-surface-container bg-surface-container-lowest p-4 sm:p-5">
                {/* ── OPTION A: UPI ──────────────────────────────────────────────── */}
                {selectedPaymentMethod === "upi" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                      <span className="font-label-md font-bold text-on-surface">Choose UPI App</span>
                      <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                        Fast Demo Flow
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { id: "gpay", label: "Google Pay", icon: "GPay", color: "text-blue-600" },
                        { id: "phonepe", label: "PhonePe", icon: "PhonePe", color: "text-purple-600" },
                        { id: "paytm", label: "Paytm", icon: "Paytm", color: "text-sky-600" },
                        { id: "bhim", label: "BHIM UPI", icon: "BHIM", color: "text-emerald-600" },
                      ].map((app) => (
                        <div
                          key={app.id}
                          onClick={() => setSelectedUpiApp(app.id as UpiAppType)}
                          className={`p-3 rounded-xl border text-center cursor-pointer transition-all ${
                            selectedUpiApp === app.id
                              ? "border-primary bg-primary-fixed/30 font-bold text-primary shadow-xs"
                              : "border-surface-container bg-surface-container-low text-on-surface-variant hover:border-outline"
                          }`}
                        >
                          <div className={`font-black text-sm tracking-tight ${app.color}`}>
                            {app.icon}
                          </div>
                          <span className="text-xs mt-1 block">{app.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Demo VPA input */}
                    <div className="rounded-lg bg-surface-container-low p-3 border border-surface-container">
                      <label className="block text-xs font-semibold text-on-surface mb-1">
                        Virtual Payment Address (VPA)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customVpa}
                          onChange={(e) => setCustomVpa(e.target.value)}
                          placeholder="e.g. mobile@upi"
                          className="flex-1 rounded-lg border border-surface-container bg-surface-container-lowest px-3 py-1.5 text-xs font-mono text-on-surface outline-none focus:border-primary"
                        />
                        <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                          <Check className="h-3.5 w-3.5 mr-1" /> Auto-Verified
                        </span>
                      </div>
                      <p className="text-[11px] text-outline mt-1.5">
                        Demo note: Clicking Confirm will simulate UPI push notification approval in 1 second.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── OPTION B: CREDIT / DEBIT CARD ──────────────────────────────── */}
                {selectedPaymentMethod === "card" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                      <div className="flex items-center gap-2">
                        <span className="font-label-md font-bold text-on-surface">Card Details</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary-fixed px-1.5 py-0.5 rounded">
                          {cardNetwork}
                        </span>
                      </div>
                      <span className="text-[11px] text-outline">Simulated Test Card</span>
                    </div>

                    {/* Interactive Virtual Card Preview */}
                    <div className="rounded-xl bg-gradient-to-r from-[#1E293B] to-[#0F172A] p-4 text-white shadow-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono tracking-widest text-slate-300">PATRONET DEMO CARD</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          {cardNetwork}
                        </span>
                      </div>
                      <div className="font-mono text-base tracking-widest text-slate-100 py-1">
                        {cardData.cardNumber}
                      </div>
                      <div className="flex justify-between items-end text-xs font-mono">
                        <div>
                          <span className="text-[9px] block text-slate-400 uppercase">Cardholder</span>
                          <span className="font-medium text-slate-200 uppercase">{cardData.cardholderName}</span>
                        </div>
                        <div>
                          <span className="text-[9px] block text-slate-400 uppercase">Expires</span>
                          <span className="font-medium text-slate-200">
                            {cardData.expiryMonth}/{cardData.expiryYear}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Dummy Input Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="sm:col-span-2">
                        <label className="block font-semibold text-on-surface mb-1">Card Number</label>
                        <input
                          type="text"
                          value={cardData.cardNumber}
                          onChange={(e) => handleCardNumberChange(e.target.value)}
                          maxLength={19}
                          placeholder="4532 0000 0000 8821"
                          className="w-full rounded-lg border border-surface-container bg-surface-container-low px-3 py-2 font-mono text-on-surface outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-on-surface mb-1">Cardholder Name</label>
                        <input
                          type="text"
                          value={cardData.cardholderName}
                          onChange={(e) => setCardData({ ...cardData, cardholderName: e.target.value })}
                          placeholder="Name as on card"
                          className="w-full rounded-lg border border-surface-container bg-surface-container-low px-3 py-2 text-on-surface outline-none focus:border-primary"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block font-semibold text-on-surface mb-1">Valid Thru</label>
                          <input
                            type="text"
                            value={`${cardData.expiryMonth}/${cardData.expiryYear}`}
                            onChange={(e) => {
                              const [m = "", y = ""] = e.target.value.split("/")
                              setCardData({ ...cardData, expiryMonth: m.slice(0, 2), expiryYear: y.slice(0, 2) })
                            }}
                            placeholder="MM/YY"
                            maxLength={5}
                            className="w-full rounded-lg border border-surface-container bg-surface-container-low px-3 py-2 text-center font-mono text-on-surface outline-none focus:border-primary"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-on-surface mb-1">CVV</label>
                          <input
                            type="password"
                            value={cardData.cvv}
                            onChange={(e) => setCardData({ ...cardData, cvv: e.target.value.slice(0, 4) })}
                            placeholder="•••"
                            maxLength={4}
                            className="w-full rounded-lg border border-surface-container bg-surface-container-low px-3 py-2 text-center font-mono text-on-surface outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── OPTION C: EMI ──────────────────────────────────────────────── */}
                {selectedPaymentMethod === "emi" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                      <span className="font-label-md font-bold text-on-surface">Select EMI Tenure</span>
                      <span className="text-[11px] font-semibold text-primary bg-primary-fixed px-2 py-0.5 rounded">
                        No Cost EMI (Demo)
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        { months: 3, interest: "0%" },
                        { months: 6, interest: "0%" },
                        { months: 9, interest: "12% p.a." },
                        { months: 12, interest: "14% p.a." },
                      ].map((plan) => {
                        const monthlyAmount = (netPayable / plan.months).toFixed(0)
                        const isSelected = selectedEmiMonths === plan.months
                        return (
                          <div
                            key={plan.months}
                            onClick={() => setSelectedEmiMonths(plan.months)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? "border-primary bg-primary-fixed/30 font-bold text-primary shadow-xs"
                                : "border-surface-container bg-surface-container-low text-on-surface-variant hover:border-outline"
                            }`}
                          >
                            <div>
                              <span className="text-xs font-bold block text-on-surface">
                                {plan.months} Months Plan
                              </span>
                              <span className="text-[11px] text-outline">
                                Interest: {plan.interest}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-bold text-primary">
                                ₹{monthlyAmount}/mo
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    <p className="text-[11px] text-outline">
                      Demo note: Illustrative instalment schedule computed dynamically on ₹{netPayable.toFixed(2)}.
                    </p>
                  </div>
                )}

                {/* ── OPTION D: GIFT CARDS ────────────────────────────────────────── */}
                {selectedPaymentMethod === "gift_card" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                      <span className="font-label-md font-bold text-on-surface">
                        PATRONET Digital Gift Card
                      </span>
                      {appliedGiftCard && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Active: {appliedGiftCard.code}
                        </span>
                      )}
                    </div>

                    {/* Gift Card Input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={giftCardInput}
                        onChange={(e) => setGiftCardInput(e.target.value.toUpperCase())}
                        placeholder="Enter voucher code (e.g. PATRONET500)"
                        className="flex-1 rounded-lg border border-surface-container bg-surface-container-low px-3 py-2 text-xs font-mono uppercase text-on-surface outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyGiftCard()}
                        disabled={validatingGiftCard || !giftCardInput.trim()}
                        className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-50"
                      >
                        {validatingGiftCard ? "Checking…" : "Apply"}
                      </button>
                    </div>

                    {/* Feedback Message */}
                    {giftCardMessage && (
                      <p
                        className={`text-xs font-medium ${
                          giftCardMessage.type === "success" ? "text-emerald-600" : "text-error"
                        }`}
                      >
                        {giftCardMessage.text}
                      </p>
                    )}

                    {/* Pre-seeded Demo Voucher Chips */}
                    <div>
                      <span className="text-[11px] font-semibold text-outline block mb-1.5">
                        Quick Demo Vouchers (Click to Test):
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {demoCards.map((card) => (
                          <button
                            key={card.code}
                            type="button"
                            onClick={() => handleApplyGiftCard(card.code)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary-fixed/20 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary-fixed/40 transition-colors"
                          >
                            <Gift className="h-3 w-3" />
                            <span>{card.code} (₹{Number(card.balance).toFixed(0)})</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {isFullyCoveredByGiftCard && (
                      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-800 text-xs font-medium flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>Order is 100% funded by your gift card balance! Zero additional payment needed.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ── OPTION E: CASH ON DELIVERY ──────────────────────────────────── */}
                {selectedPaymentMethod === "cod" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-surface-container">
                      <span className="font-label-md font-bold text-on-surface">Cash on Delivery</span>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Eligible
                      </span>
                    </div>

                    <div className="rounded-lg bg-surface-container-low p-3.5 border border-surface-container text-xs text-on-surface-variant space-y-1.5">
                      <p className="font-semibold text-on-surface">Pay ₹{netPayable.toFixed(2)} when package arrives.</p>
                      <p>
                        Our delivery agent accepts cash or UPI QR scan on delivery. Please keep exact change ready.
                      </p>
                    </div>

                    <p className="text-[11px] text-outline">
                      Demo note: Clicking Confirm will place the order and set payment status to Pending (COD).
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: Step 3 Order Summary & Checkout Action (4 cols on lg) */}
          <div className="lg:col-span-4 space-y-space-md lg:sticky lg:top-24">
            <section aria-labelledby="step-summary-heading" className="rounded-2xl border border-surface-container bg-surface-container-lowest p-space-md sm:p-space-lg shadow-xs">
              <h2 id="step-summary-heading" className="font-title-md font-bold text-primary pb-3 border-b border-surface-container">
                Order Summary
              </h2>

              {/* Items Snapshot */}
              <div className="mt-3 max-h-56 overflow-y-auto space-y-2.5 pr-1 divide-y divide-surface-container/60">
                {cartItems.map((ci) => (
                  <div key={ci.id} className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface-container font-bold text-[10px] text-outline">
                        {ci.quantity}×
                      </span>
                      <span className="font-medium text-on-surface truncate">
                        {ci.product.name}
                      </span>
                    </div>
                    <span className="font-semibold text-on-surface shrink-0">
                      {formatPrice(ci.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div className="mt-4 pt-3 border-t border-surface-container space-y-2 text-xs">
                <div className="flex justify-between text-on-surface-variant">
                  <span>Items Subtotal</span>
                  <span className="font-semibold">{formatPrice(cartSubtotalNum)}</span>
                </div>

                <div className="flex justify-between text-on-surface-variant">
                  <span>Delivery Fee</span>
                  <span>
                    {deliveryCharge === 0 ? (
                      <span className="font-bold text-emerald-600">FREE</span>
                    ) : (
                      formatPrice(deliveryCharge)
                    )}
                  </span>
                </div>

                {appliedGiftCard && giftCardDeduction > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span className="flex items-center gap-1">
                      <span>Gift Card ({appliedGiftCard.code})</span>
                      <button
                        type="button"
                        onClick={handleRemoveGiftCard}
                        className="text-error hover:underline text-[10px] ml-1"
                      >
                        (Remove)
                      </button>
                    </span>
                    <span>−{formatPrice(giftCardDeduction)}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm font-bold text-primary pt-2 border-t border-surface-container">
                  <span>Total Payable</span>
                  <span className="font-headline-sm">{formatPrice(netPayable)}</span>
                </div>
              </div>

              {/* Estimated Delivery Window */}
              <div className="mt-4 rounded-xl bg-surface-container-low p-3 border border-surface-container flex items-start gap-2 text-xs">
                <Truck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-primary block">Estimated Delivery</span>
                  <span className="text-outline">2–4 business days to {selectedAddress?.city || "your location"}</span>
                </div>
              </div>

              {/* Active Delivery Destination Note */}
              {selectedAddress && (
                <div className="mt-2 text-[11px] text-outline px-1 truncate">
                  Shipping to: <strong className="text-on-surface">{selectedAddress.full_name}</strong>, {selectedAddress.city}
                </div>
              )}

              {/* Interactive Simulation Status Callout */}
              {simulationStep && (
                <div className="mt-3 rounded-lg bg-primary-fixed/40 border border-primary/20 p-2.5 text-xs text-primary flex items-center gap-2">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                  <span className="font-semibold">{simulationStep}</span>
                </div>
              )}

              {/* Local Error Alert near button */}
              {pageError && (
                <div role="alert" className="mt-3 rounded-xl bg-error-container/20 border border-error/40 p-3 text-error flex items-start gap-2.5 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-error" />
                  <div>
                    <p className="font-bold">Unable to Complete Order</p>
                    <p className="mt-0.5 leading-relaxed">{pageError}</p>
                  </div>
                </div>
              )}

              {/* Final Place Order Button */}
              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={isProcessing || isSubmitted || !selectedAddressId}
                className="mt-space-md w-full rounded-xl bg-primary py-3.5 px-4 text-on-primary font-label-md font-bold shadow-xs hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Processing Demo Order…</span>
                  </>
                ) : isSubmitted ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Order Placed</span>
                  </>
                ) : isFullyCoveredByGiftCard ? (
                  <>
                    <Gift className="h-4 w-4" />
                    <span>{isDemoMode ? "Place Demo Order" : "Redeem Voucher & Pay"}</span>
                  </>
                ) : selectedPaymentMethod === "cod" ? (
                  <>
                    <Banknote className="h-4 w-4" />
                    <span>{isDemoMode ? "Place Demo Order" : "Confirm Cash on Delivery"}</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>{isDemoMode ? "Place Demo Order" : `Pay ${formatPrice(netPayable)}`}</span>
                  </>
                )}
              </button>

              <p className="text-[11px] text-center text-outline mt-2">
                Simulated demo checkout. Safe &amp; verified.
              </p>
            </section>
          </div>
        </div>
      </Container>
    </div>
  )
}
