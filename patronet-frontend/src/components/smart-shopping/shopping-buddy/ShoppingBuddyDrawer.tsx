import { useEffect, useRef, useState } from "react"
import {
  Bot,
  Eye,
  Info,
  Layers,
  RefreshCw,
  Send,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react"
import { useSmartShopping } from "../SmartShoppingContext"
import {
  getRecommendationsForQuery,
  type RecommendedProductItem,
} from "./shopping-buddy.engine"

interface ChatMessage {
  id: string
  sender: "user" | "assistant"
  text: string
  recommendations?: RecommendedProductItem[]
  suggestedFollowUps?: string[]
  timestamp: string
}

const SAMPLE_PROMPTS = [
  "💻 Need a laptop under ₹60,000 for work & coding",
  "🎧 Wireless headphones for studying with ANC",
  "📱 Phone under ₹30,000 with great camera",
  "⌚ Smartwatch under ₹15,000 with fitness tracking",
  "❄️ Refrigerator for a family of four",
]

export function ShoppingBuddyDrawer() {
  const {
    activeAssistant,
    closeAssistant,
    onNavigateProduct,
    onAddToCart,
    addToCompare,
    isCompared,
    openAssistant,
  } = useSmartShopping()

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome-1",
      sender: "assistant",
      text: "👋 Hey there! I'm your PATRONET Shopping Buddy. Instead of browsing through dozens of filters, just tell me what you're looking for, your budget, or how you plan to use it!",
      timestamp: "Just now",
    },
  ])

  const [inputText, setInputText] = useState("")
  const [isThinking, setIsThinking] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const msgCounter = useRef(2)

  useEffect(() => {
    if (activeAssistant === "shopping-buddy") {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isThinking, activeAssistant])

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim()
    if (!query || isThinking) return

    const timeString = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const userMessage: ChatMessage = {
      id: `user-${msgCounter.current++}`,
      sender: "user",
      text: query,
      timestamp: timeString,
    }

    setMessages((prev) => [...prev, userMessage])
    setInputText("")
    setIsThinking(true)

    try {
      const response = await getRecommendationsForQuery(query)

      const assistantMessage: ChatMessage = {
        id: `assistant-${msgCounter.current++}`,
        sender: "assistant",
        text: response.messageText,
        recommendations: response.recommendations,
        suggestedFollowUps: response.suggestedFollowUps,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch {
      const errorMessage: ChatMessage = {
        id: `assistant-err-${msgCounter.current++}`,
        sender: "assistant",
        text: "I encountered a minor issue searching the catalogue. Please try searching again with a product name or budget.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsThinking(false)
    }
  }

  const handleAddToCart = async (productId: string) => {
    if (!onAddToCart || addingId) return
    setAddingId(productId)
    try {
      await onAddToCart(productId, 1)
    } finally {
      setAddingId(null)
    }
  }

  if (activeAssistant !== "shopping-buddy") return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end p-0 sm:p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
      <div className="relative flex h-[90vh] sm:h-[85vh] w-full sm:max-w-xl flex-col rounded-t-3xl sm:rounded-2xl border border-surface-container bg-surface-container-lowest shadow-2xl overflow-hidden">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-surface-container/80 bg-surface-container-low px-4 sm:px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-title-md text-title-md font-bold text-on-surface">
                  Shopping Buddy
                </h2>
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Catalogue AI
                </span>
              </div>
              <p className="text-[11px] text-on-surface-variant">
                Conversational recommendation assistant
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeAssistant}
            aria-label="Close Shopping Buddy"
            className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Messages Stream ─────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-primary text-on-primary rounded-br-xs shadow-xs"
                    : "bg-surface-container-low text-on-surface rounded-bl-xs border border-surface-container/60"
                }`}
              >
                <p>{msg.text}</p>

                {/* Recommendations Carousel / Cards */}
                {msg.recommendations && msg.recommendations.length > 0 && (
                  <div className="mt-3 space-y-2.5 pt-2 border-t border-surface-container/70">
                    {msg.recommendations.map((rec) => {
                      const isItemCompared = isCompared(rec.product.id)
                      return (
                        <div
                          key={rec.product.id}
                          className="rounded-xl border border-surface-container bg-surface-container-lowest p-3 shadow-xs space-y-2 text-on-surface transition-all hover:border-primary/40"
                        >
                          <div className="flex gap-3">
                            <div className="h-16 w-16 shrink-0 rounded-lg bg-surface-container-low p-1 overflow-hidden flex items-center justify-center">
                              <img
                                src={rec.product.imageUrl}
                                alt={rec.product.name}
                                className="h-full w-full object-contain"
                                onError={(e) => {
                                  e.currentTarget.onerror = null
                                  e.currentTarget.src =
                                    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500&q=80"
                                }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-outline">
                                {rec.product.brand || rec.product.categoryName}
                              </span>
                              <h4 className="font-semibold text-xs sm:text-sm line-clamp-1 leading-tight text-on-surface">
                                {rec.product.name}
                              </h4>
                              <p className="font-headline-sm text-sm font-bold text-primary mt-0.5">
                                ₹{rec.product.price.toLocaleString("en-IN")}
                              </p>
                            </div>
                          </div>

                          {/* Why it matches pill */}
                          <div className="rounded-lg bg-primary-fixed/25 px-2.5 py-1 text-[11px] text-primary font-medium leading-snug">
                            <span className="font-bold">Why it matches: </span>
                            {rec.whyItMatches}
                          </div>

                          {/* Matched Specs Chips */}
                          {rec.matchedSpecs.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {rec.matchedSpecs.map((spec, i) => (
                                <span
                                  key={i}
                                  className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] text-on-surface-variant font-medium"
                                >
                                  ✓ {spec}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="grid grid-cols-3 gap-1.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                closeAssistant()
                                onNavigateProduct?.(rec.product.id)
                              }}
                              className="flex items-center justify-center gap-1 rounded-lg border border-surface-container bg-surface-container-low py-1.5 text-[11px] font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                            >
                              <Eye className="h-3 w-3 text-primary" />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleAddToCart(rec.product.id)}
                              disabled={addingId === rec.product.id}
                              className="flex items-center justify-center gap-1 rounded-lg bg-primary py-1.5 text-[11px] font-bold text-on-primary shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                              <ShoppingBag className="h-3 w-3" />
                              <span>{addingId === rec.product.id ? "Adding…" : "Add"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => addToCompare(rec.product)}
                              className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors ${
                                isItemCompared
                                  ? "bg-secondary-container text-on-secondary"
                                  : "border border-surface-container bg-surface-container-low text-on-surface hover:bg-surface-container-high"
                              }`}
                            >
                              <Layers className="h-3 w-3" />
                              <span>{isItemCompared ? "Comparing" : "Compare"}</span>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Follow-up suggestions */}
                {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-surface-container/60 space-y-1">
                    <p className="text-[11px] font-semibold text-on-surface-variant">Follow-up suggestions:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.suggestedFollowUps.map((prompt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            if (prompt.includes("Compare these")) {
                              openAssistant("compare")
                            } else {
                              void handleSendMessage(prompt)
                            }
                          }}
                          className="rounded-lg border border-primary/30 bg-surface-container-lowest px-2 py-1 text-[11px] text-primary font-medium hover:bg-primary-fixed/30 transition-colors text-left"
                        >
                          → {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-on-surface-variant mt-1 px-1">{msg.timestamp}</span>
            </div>
          ))}

          {/* Thinking / Searching Indicator */}
          {isThinking && (
            <div className="flex items-center gap-2 rounded-2xl bg-surface-container-low p-3.5 text-xs text-on-surface-variant border border-surface-container w-fit">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <span>Analyzing requirements & scanning catalogue…</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* ── Example Prompts (when only welcome message) ──────────── */}
        {messages.length === 1 && (
          <div className="border-t border-surface-container/60 bg-surface-container-low/50 px-4 py-2.5">
            <p className="text-[11px] font-bold text-on-surface-variant mb-1.5 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Try asking:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => void handleSendMessage(prompt)}
                  className="rounded-lg border border-surface-container bg-surface-container-lowest px-2.5 py-1 text-xs text-on-surface hover:bg-primary-fixed/30 hover:border-primary/40 transition-colors text-left"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input Box & Disclaimer ──────────────────────────────── */}
        <div className="border-t border-surface-container/80 bg-surface-container-lowest p-3 sm:p-4 space-y-2">
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
              placeholder="e.g. Headphones under ₹5,000 for work or studying…"
              disabled={isThinking}
              className="flex-1 rounded-xl border border-surface-container bg-surface-container-low px-3.5 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={isThinking || !inputText.trim()}
              aria-label="Send message to Shopping Buddy"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <p className="text-[10px] text-center text-on-surface-variant flex items-center justify-center gap-1">
            <Info className="h-3 w-3 text-primary" />
            Demo Intelligence: Recommendations are powered by local catalogue evaluation.
          </p>
        </div>
      </div>
    </div>
  )
}
