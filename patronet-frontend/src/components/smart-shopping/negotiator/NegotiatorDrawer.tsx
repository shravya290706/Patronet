import { useEffect, useRef, useState } from "react"
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Handshake,
  RefreshCw,
  Send,
  ShieldCheck,
  Store,
  Tag,
  User,
  X,
} from "lucide-react"
import { useSmartShopping } from "../SmartShoppingContext"
import {
  extractPriceFromText,
  simulateSellerDecision,
  type NegotiationMessage,
  type NegotiationPhase,
} from "./negotiator.engine"

export function NegotiatorDrawer() {
  const {
    activeAssistant,
    closeAssistant,
    cartSubtotal,
    negotiateProduct,
  } = useSmartShopping()

  // Product Context
  const originalPrice = negotiateProduct
    ? negotiateProduct.price
    : cartSubtotal > 0
    ? cartSubtotal
    : 49999

  const productName = negotiateProduct
    ? negotiateProduct.name
    : cartSubtotal > 0
    ? "Active Shopping Cart Bundle"
    : "Premium Ultrabook Laptop (Demo Item)"

  const productImage = negotiateProduct?.imageUrl

  const sellerName = "Apex Retail Hub (Verified Merchant - Simulated)"

  // Negotiation Session State
  const [round, setRound] = useState(1)
  const [phase, setPhase] = useState<NegotiationPhase>("ready")
  const [currentSellerOffer, setCurrentSellerOffer] = useState(originalPrice)
  const [lastAgreedDiscount, setLastAgreedDiscount] = useState(0)
  const [inputText, setInputText] = useState("")
  const [isConsultingSeller, setIsConsultingSeller] = useState(false)
  const [errorNotice, setErrorNotice] = useState<string | null>(null)
  const messageCounter = useRef(1)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  const [messages, setMessages] = useState<NegotiationMessage[]>([
    {
      id: "init-1",
      sender: "intermediary",
      text: `Hello! I'm your PATRONET Deal Intermediary. I can negotiate directly with the merchant on your behalf for "${productName}" (Catalogue Price: ₹${originalPrice.toLocaleString(
        "en-IN"
      )}). Tell me what price you had in mind, or ask if they have room for a discount!`,
      timestamp: "Just now",
    },
  ])

  useEffect(() => {
    if (activeAssistant === "negotiator") {
      chatScrollRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isConsultingSeller, activeAssistant])

  // User sends proposal or natural message
  const handleSendMessage = async (textToSend?: string, directPrice?: number) => {
    const rawText = (textToSend || inputText).trim()
    if (!rawText || isConsultingSeller) return

    setErrorNotice(null)
    const proposedPrice = directPrice !== undefined ? directPrice : extractPriceFromText(rawText, originalPrice)

    if (proposedPrice !== null && proposedPrice <= 0) {
      setErrorNotice("Please propose a realistic positive offer amount.")
      return
    }

    if (proposedPrice !== null && proposedPrice >= originalPrice) {
      setErrorNotice(
        `Please propose an amount lower than the catalogue price of ₹${originalPrice.toLocaleString(
          "en-IN"
        )}.`
      )
      return
    }

    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })

    // 1. Append Customer Message
    const customerMsg: NegotiationMessage = {
      id: `msg-${messageCounter.current++}`,
      sender: "customer",
      text: rawText,
      priceMentioned: proposedPrice || undefined,
      timestamp: time,
    }

    setMessages((prev) => [...prev, customerMsg])
    setInputText("")
    setIsConsultingSeller(true)
    setPhase("awaiting_seller")

    // 2. Intermediary Acknowledgment
    await new Promise((r) => setTimeout(r, 600))
    const intermedId = `msg-${messageCounter.current++}`
    const intermedNotice: NegotiationMessage = {
      id: intermedId,
      sender: "intermediary",
      text: "Checking with the merchant's sales desk regarding your proposal. Please give me a quick moment...",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }
    setMessages((prev) => [...prev, intermedNotice])

    // 3. Simulated Merchant Response Delay
    await new Promise((r) => setTimeout(r, 1100))

    const decision = simulateSellerDecision(originalPrice, proposedPrice, round)

    // Append Merchant Message
    const sellerMsg: NegotiationMessage = {
      id: `msg-${messageCounter.current++}`,
      sender: "seller",
      text: decision.sellerSpeech,
      priceMentioned: decision.counterPrice,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    // Append Intermediary Translation & Advice
    const intermedFollowUp: NegotiationMessage = {
      id: `msg-${messageCounter.current++}`,
      sender: "intermediary",
      text: decision.intermediaryFollowUp,
      priceMentioned: decision.counterPrice,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, sellerMsg, intermedFollowUp])
    setCurrentSellerOffer(decision.counterPrice)
    setIsConsultingSeller(false)

    if (decision.isAccepted) {
      setPhase("seller_countered")
    } else {
      setPhase("seller_countered")
      setRound((r) => r + 1)
    }
  }

  // Action: Accept current seller offer
  const handleAcceptOffer = () => {
    const discount = originalPrice - currentSellerOffer
    setLastAgreedDiscount(discount)
    setPhase("deal_accepted")

    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const acceptMsg: NegotiationMessage = {
      id: `msg-${messageCounter.current++}`,
      sender: "customer",
      text: `I accept the seller's offer of ₹${currentSellerOffer.toLocaleString("en-IN")}. Thank you!`,
      timestamp: time,
    }
    const finalIntermed: NegotiationMessage = {
      id: `msg-${messageCounter.current++}`,
      sender: "intermediary",
      text: `🎉 Congratulations! We have locked in your demo price of ₹${currentSellerOffer.toLocaleString(
        "en-IN"
      )} (saving ₹${discount.toLocaleString("en-IN")}). The agreement has been documented for your presentation!`,
      timestamp: time,
    }

    setMessages((prev) => [...prev, acceptMsg, finalIntermed])
  }

  // Action: Walk away / decline
  const handleDeclineOffer = () => {
    setPhase("deal_declined")
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const declineMsg: NegotiationMessage = {
      id: `msg-${messageCounter.current++}`,
      sender: "customer",
      text: "I cannot accept this offer at this time. I will pass.",
      timestamp: time,
    }
    const closeMsg: NegotiationMessage = {
      id: `msg-${messageCounter.current++}`,
      sender: "intermediary",
      text: `Understood! I've informed the merchant that you've declined the offer. The product remains available at the standard catalogue price of ₹${originalPrice.toLocaleString(
        "en-IN"
      )} whenever you're ready.`,
      timestamp: time,
    }
    setMessages((prev) => [...prev, declineMsg, closeMsg])
  }

  // Quick counter suggestions
  const handleQuickCounter = (delta: number) => {
    const target = Math.max(100, currentSellerOffer - delta)
    handleSendMessage(`Could the merchant consider ₹${target.toLocaleString("en-IN")}?`, target)
  }

  if (activeAssistant !== "negotiator") return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative flex h-[92vh] sm:h-[88vh] w-full sm:max-w-xl flex-col rounded-t-3xl sm:rounded-2xl border border-surface-container bg-surface-container-lowest shadow-2xl overflow-hidden">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-surface-container bg-surface-container-low px-4 sm:px-5 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-xs">
              <Handshake className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-title-md text-title-md font-bold text-on-surface truncate">
                  PATRONET Negotiator
                </h2>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300 shrink-0">
                  3-Party Bargaining
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant truncate">
                Customer ↔ AI Intermediary ↔ Simulated Merchant
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeAssistant}
            aria-label="Close Negotiator"
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Product & Seller Bar ────────────────────────────────────────── */}
        <div className="border-b border-surface-container/80 bg-surface-container-lowest px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            {productImage ? (
              <img
                src={productImage}
                alt={productName}
                className="h-10 w-10 shrink-0 rounded-lg object-contain bg-surface-container-low p-1 border border-surface-container"
              />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded-lg bg-surface-container-low flex items-center justify-center text-primary font-bold">
                <Tag className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-bold text-on-surface truncate">{productName}</p>
              <p className="text-[11px] text-outline flex items-center gap-1.5">
                <Store className="h-3 w-3 text-amber-700" />
                <span className="truncate">{sellerName}</span>
              </p>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] text-outline block">List Price</span>
            <span className="font-bold text-primary text-sm sm:text-base">
              ₹{originalPrice.toLocaleString("en-IN")}
            </span>
          </div>
        </div>

        {/* ── Demo Safety Notice Banner ─────────────────────────────────────── */}
        <div className="bg-amber-50 px-4 py-1.5 border-b border-amber-200/80 flex items-center gap-2 text-[11px] text-amber-900">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-700 shrink-0" />
          <span>
            <strong>Demo Simulation:</strong> Concessions here are illustrative and do not alter actual cart or checkout totals.
          </span>
        </div>

        {/* ── Dialogue Messages Stream ────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-surface-container-lowest/50">
          {messages.map((m) => {
            const isCustomer = m.sender === "customer"
            const isSeller = m.sender === "seller"

            if (isSeller) {
              return (
                <div key={m.id} className="flex flex-col items-center my-1 animate-fadeIn">
                  <div className="w-full max-w-md rounded-xl border border-amber-300 bg-amber-50/90 p-3 shadow-2xs">
                    <div className="flex items-center gap-2 pb-1 border-b border-amber-200 text-[11px] font-bold text-amber-900">
                      <Store className="h-3.5 w-3.5 text-amber-700" />
                      <span>Simulated Merchant Statement</span>
                      <span className="text-[10px] font-normal text-amber-700/80 ml-auto">{m.timestamp}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-amber-950 leading-relaxed italic font-serif">
                      "{m.text}"
                    </p>
                  </div>
                </div>
              )
            }

            return (
              <div
                key={m.id}
                className={`flex gap-2.5 max-w-[85%] ${
                  isCustomer ? "ml-auto flex-row-reverse" : "mr-auto"
                } animate-fadeIn`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-xs ${
                    isCustomer ? "bg-primary text-on-primary" : "bg-primary-container text-primary"
                  }`}
                >
                  {isCustomer ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                </div>

                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                    isCustomer
                      ? "bg-primary text-on-primary rounded-tr-xs"
                      : "bg-surface-container-low text-on-surface border border-surface-container/70 rounded-tl-xs"
                  }`}
                >
                  {!isCustomer && (
                    <span className="block text-[10px] font-bold text-primary mb-1">
                      PATRONET Deal Intermediary
                    </span>
                  )}
                  <p>{m.text}</p>
                  <span
                    className={`block text-[9px] mt-1 text-right ${
                      isCustomer ? "text-on-primary/75" : "text-outline"
                    }`}
                  >
                    {m.timestamp}
                  </span>
                </div>
              </div>
            )
          })}

          {isConsultingSeller && (
            <div className="flex items-center gap-2 text-xs text-primary bg-primary-fixed/30 p-2.5 rounded-xl border border-primary/20 animate-pulse w-fit">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
              <span>Intermediary is consulting merchant sales desk…</span>
            </div>
          )}

          <div ref={chatScrollRef} />
        </div>

        {/* ── Status Deal Cards (Accepted / Counter / Declined) ───────────── */}
        {phase === "deal_accepted" ? (
          <div className="border-t border-emerald-200 bg-emerald-50 p-4 text-center space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="font-title-md font-bold text-emerald-900">
              Demo Bargain Agreement Approved!
            </h3>
            <p className="text-xs text-emerald-800">
              Agreed Price: <strong>₹{currentSellerOffer.toLocaleString("en-IN")}</strong> (Saved ₹{lastAgreedDiscount.toLocaleString("en-IN")})
            </p>
            <p className="text-[11px] text-outline">
              College demo note: This is an illustrative simulation. Standard checkout prices remain active.
            </p>
            <button
              type="button"
              onClick={closeAssistant}
              className="mt-1 rounded-xl bg-emerald-700 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition-colors shadow-xs"
            >
              Close &amp; Continue Shopping
            </button>
          </div>
        ) : phase === "deal_declined" ? (
          <div className="border-t border-surface-container bg-surface-container-low p-4 text-center space-y-2">
            <p className="text-xs font-bold text-on-surface">Negotiation Concluded (No Deal)</p>
            <p className="text-xs text-outline">The standard price of ₹{originalPrice.toLocaleString("en-IN")} remains active.</p>
            <button
              type="button"
              onClick={closeAssistant}
              className="mt-1 rounded-xl bg-surface-container-high px-5 py-2 text-xs font-bold text-on-surface hover:bg-surface-container-highest transition-colors"
            >
              Close Negotiator
            </button>
          </div>
        ) : (
          <div className="border-t border-surface-container/80 bg-surface-container-lowest p-3 sm:p-4 space-y-2.5">
            {/* Interactive Action Buttons if a counteroffer is active */}
            {phase === "seller_countered" && (
              <div className="space-y-2 pb-1">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-amber-500/10 p-2.5 rounded-xl border border-amber-300/80">
                  <div className="text-xs">
                    <span className="text-amber-900 font-bold block">
                      Active Merchant Offer: ₹{currentSellerOffer.toLocaleString("en-IN")}
                    </span>
                    <span className="text-[11px] text-amber-800">
                      Saves ₹{(originalPrice - currentSellerOffer).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleAcceptOffer}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs"
                    >
                      Accept Deal
                    </button>
                    <button
                      type="button"
                      onClick={handleDeclineOffer}
                      className="rounded-lg bg-surface-container-high px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-error hover:text-white transition-colors"
                    >
                      Walk Away
                    </button>
                  </div>
                </div>

                {/* Quick Counter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto text-[11px]">
                  <span className="text-outline text-[10px] shrink-0">Quick Counter:</span>
                  <button
                    type="button"
                    onClick={() => handleQuickCounter(500)}
                    className="rounded-full bg-surface-container-low px-2.5 py-1 border border-surface-container font-semibold hover:border-primary text-primary shrink-0 cursor-pointer"
                  >
                    −₹500 more
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCounter(1000)}
                    className="rounded-full bg-surface-container-low px-2.5 py-1 border border-surface-container font-semibold hover:border-primary text-primary shrink-0 cursor-pointer"
                  >
                    −₹1,000 more
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickCounter(2000)}
                    className="rounded-full bg-surface-container-low px-2.5 py-1 border border-surface-container font-semibold hover:border-primary text-primary shrink-0 cursor-pointer"
                  >
                    −₹2,000 more
                  </button>
                </div>
              </div>
            )}

            {/* Error Notification */}
            {errorNotice && (
              <div className="flex items-center gap-1.5 rounded-lg bg-error-container/20 p-2 text-xs text-error">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{errorNotice}</span>
              </div>
            )}

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void handleSendMessage()
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder='e.g. "Can we do ₹55,000?" or "What is your best offer?"'
                disabled={isConsultingSeller}
                className="flex-1 rounded-xl border border-surface-container bg-surface-container-low px-3.5 py-2.5 text-xs text-on-surface placeholder:text-outline focus:border-primary focus:bg-surface-container-lowest focus:outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isConsultingSeller}
                aria-label="Send message to intermediary"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
