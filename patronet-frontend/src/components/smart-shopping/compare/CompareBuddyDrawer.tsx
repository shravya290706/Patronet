import { useState } from "react"
import {
  Check,
  CheckCircle2,
  Columns,
  Eye,
  Info,
  Scale,
  ShoppingBag,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react"
import { useSmartShopping } from "../SmartShoppingContext"
import {
  calculateCompareRecommendations,
  extractProductSpecs,
  type ComparePreference,
} from "./compare.utils"

const PREFERENCE_OPTIONS: { id: ComparePreference; label: string; icon: string }[] = [
  { id: "best_value", label: "Best Overall Value", icon: "⚖️" },
  { id: "lowest_price", label: "Lowest Price", icon: "💰" },
  { id: "performance", label: "Best Performance", icon: "⚡" },
  { id: "battery", label: "Best Battery Life", icon: "🔋" },
  { id: "storage", label: "Best Storage", icon: "💾" },
  { id: "professional", label: "Professional / Work Use", icon: "💼" },
]

export function CompareBuddyDrawer() {
  const {
    comparisonList,
    removeFromCompare,
    clearCompare,
    activeAssistant,
    closeAssistant,
    onNavigateProduct,
    onAddToCart,
  } = useSmartShopping()

  const [preference, setPreference] = useState<ComparePreference>("best_value")
  const [addingId, setAddingId] = useState<string | null>(null)

  const recommendation = calculateCompareRecommendations(comparisonList, preference)
  const minPrice = comparisonList.length > 0 ? Math.min(...comparisonList.map((p) => p.price)) : 0

  const handleAddToCart = async (productId: string) => {
    if (!onAddToCart || addingId) return
    setAddingId(productId)
    try {
      await onAddToCart(productId, 1)
    } finally {
      setAddingId(null)
    }
  }

  if (activeAssistant !== "compare") return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 backdrop-blur-xs animate-fadeIn">
      <div className="relative flex h-[92vh] w-full max-w-7xl flex-col rounded-2xl border border-surface-container bg-surface-container-lowest shadow-2xl overflow-hidden">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-surface-container/80 bg-surface-container-low px-4 sm:px-6 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-on-primary shadow-xs">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-title-md text-title-md sm:text-headline-sm font-bold text-on-surface">
                  Compare Buddy
                </h2>
                <span className="rounded-full bg-primary-fixed px-2.5 py-0.5 text-xs font-bold text-primary">
                  {comparisonList.length} of 4 items
                </span>
              </div>
              <p className="text-xs text-on-surface-variant hidden sm:block">
                Side-by-side spec comparison and catalogue-backed recommendation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {comparisonList.length > 0 && (
              <button
                type="button"
                onClick={clearCompare}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-outline hover:bg-surface-container-high hover:text-error transition-colors"
                title="Clear all compared items"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear List</span>
              </button>
            )}
            <button
              type="button"
              onClick={closeAssistant}
              aria-label="Close Compare Buddy"
              className="rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container-high transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* ── Main Content Area ────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {comparisonList.length === 0 ? (
            /* Empty State */
            <div className="flex h-full min-h-[350px] flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container-low text-primary">
                <Columns className="h-8 w-8" />
              </div>
              <h3 className="font-headline-sm text-headline-sm font-bold text-on-surface">
                No Products Selected for Comparison
              </h3>
              <p className="max-w-md text-sm text-on-surface-variant leading-relaxed">
                Click the <strong>Compare</strong> button on any product card while browsing to add up to 4 items and view an intelligent side-by-side comparison.
              </p>
              <button
                type="button"
                onClick={closeAssistant}
                className="mt-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary shadow-xs hover:bg-primary/90 transition-colors"
              >
                Browse Catalogue
              </button>
            </div>
          ) : (
            <>
              {/* ── Preference Selector & Intelligent Recommendation ───── */}
              <div className="rounded-2xl border border-primary/20 bg-primary-fixed/20 p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <label htmlFor="compare-pref" className="font-label-md text-xs sm:text-sm font-bold text-primary flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" />
                      What matters most to you?
                    </label>
                    <p className="text-xs text-on-surface-variant mt-0.5">
                      Select your priority to recalculate tailored recommendation.
                    </p>
                  </div>

                  {/* Preference Pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {PREFERENCE_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPreference(opt.id)}
                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                          preference === opt.id
                            ? "bg-primary text-on-primary shadow-xs ring-2 ring-primary/30"
                            : "bg-surface-container-lowest text-on-surface hover:bg-surface-container-high border border-surface-container"
                        }`}
                      >
                        <span>{opt.icon}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recommendation Banner */}
                {recommendation && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-primary/20 text-xs sm:text-sm">
                    {/* 1. Best Overall */}
                    <div className="rounded-xl bg-surface-container-lowest p-3 border border-surface-container flex flex-col justify-between">
                      <div>
                        <span className="inline-flex items-center gap-1 font-bold text-primary uppercase text-[10px] tracking-wider mb-1">
                          <CheckCircle2 className="h-3 w-3" /> Best Overall Choice
                        </span>
                        <p className="font-semibold text-on-surface line-clamp-1">{recommendation.bestOverall.name}</p>
                        <p className="text-xs text-primary font-bold mt-0.5">
                          ₹{recommendation.bestOverall.price.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <span className="text-[11px] text-on-surface-variant mt-2 italic">
                        Balanced price & features
                      </span>
                    </div>

                    {/* 2. Best Budget */}
                    <div className="rounded-xl bg-surface-container-lowest p-3 border border-surface-container flex flex-col justify-between">
                      <div>
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 uppercase text-[10px] tracking-wider mb-1">
                          💰 Best Budget Choice
                        </span>
                        <p className="font-semibold text-on-surface line-clamp-1">{recommendation.bestBudget.name}</p>
                        <p className="text-xs text-emerald-700 font-bold mt-0.5">
                          ₹{recommendation.bestBudget.price.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <span className="text-[11px] text-on-surface-variant mt-2 italic">
                        Lowest price in comparison
                      </span>
                    </div>

                    {/* 3. Best for Selected Preference */}
                    <div className="rounded-xl bg-primary text-on-primary p-3 flex flex-col justify-between shadow-xs">
                      <div>
                        <span className="inline-flex items-center gap-1 font-bold uppercase text-[10px] tracking-wider mb-1 text-primary-fixed">
                          🎯 Best For: {PREFERENCE_OPTIONS.find((o) => o.id === preference)?.label}
                        </span>
                        <p className="font-bold line-clamp-1">{recommendation.bestPreference.name}</p>
                        <p className="text-xs font-bold mt-0.5 text-primary-fixed">
                          ₹{recommendation.bestPreference.price.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <p className="text-[11px] text-on-primary/90 mt-2 leading-relaxed">
                        {recommendation.preferenceExplanation}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Side-by-Side Comparison Grid ──────────────────────── */}
              <div className="overflow-x-auto pb-2">
                <div
                  className="grid gap-3 min-w-[720px]"
                  style={{
                    gridTemplateColumns: `repeat(${comparisonList.length}, minmax(220px, 1fr))`,
                  }}
                >
                  {comparisonList.map((product) => {
                    const specs = extractProductSpecs(product, comparisonList)
                    const isLowest = product.price === minPrice && comparisonList.length > 1
                    const isRecOverall = recommendation?.bestOverall.id === product.id
                    const isRecPref = recommendation?.bestPreference.id === product.id

                    return (
                      <div
                        key={product.id}
                        className={`rounded-2xl border p-4 bg-surface-container-lowest shadow-sm flex flex-col justify-between relative transition-all ${
                          isRecPref
                            ? "ring-2 ring-primary border-primary bg-primary-fixed/5"
                            : "border-surface-container hover:border-outline-variant"
                        }`}
                      >
                        {/* Remove item button */}
                        <button
                          type="button"
                          onClick={() => removeFromCompare(product.id)}
                          aria-label={`Remove ${product.name} from comparison`}
                          className="absolute top-3 right-3 rounded-full bg-surface-container-low p-1.5 text-outline hover:bg-error hover:text-white transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>

                        <div className="space-y-3.5">
                          {/* Badges line */}
                          <div className="flex flex-wrap gap-1 pr-7">
                            {isLowest && (
                              <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                Lowest Price
                              </span>
                            )}
                            {isRecOverall && (
                              <span className="rounded bg-primary-fixed px-2 py-0.5 text-[10px] font-bold text-primary">
                                Top Pick
                              </span>
                            )}
                            {isRecPref && (
                              <span className="rounded bg-primary text-on-primary px-2 py-0.5 text-[10px] font-bold">
                                Matched Priority
                              </span>
                            )}
                          </div>

                          {/* Product Image */}
                          <div className="relative aspect-square w-full rounded-xl bg-surface-container-low overflow-hidden flex items-center justify-center p-2">
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-full w-full object-contain"
                              onError={(e) => {
                                e.currentTarget.onerror = null
                                e.currentTarget.src =
                                  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500&q=80"
                              }}
                            />
                          </div>

                          {/* Product Name & Brand */}
                          <div>
                            <span className="text-[11px] font-bold uppercase tracking-wider text-outline">
                              {specs.brand}
                            </span>
                            <h4 className="font-semibold text-sm text-on-surface line-clamp-2 mt-0.5 leading-snug">
                              {product.name}
                            </h4>
                          </div>

                          {/* Price */}
                          <div className="rounded-xl bg-surface-container-low p-2.5">
                            <span className="text-[10px] text-on-surface-variant uppercase font-semibold">Price</span>
                            <div className="flex items-baseline justify-between mt-0.5">
                              <span className="font-headline-sm text-lg font-bold text-primary">
                                ₹{product.price.toLocaleString("en-IN")}
                              </span>
                              {isLowest && (
                                <span className="text-[10px] font-bold text-emerald-700">Best Price</span>
                              )}
                            </div>
                          </div>

                          {/* Specifications Breakdown */}
                          <div className="space-y-2 text-xs border-t border-surface-container pt-3">
                            <div>
                              <span className="font-bold text-on-surface text-[11px] uppercase tracking-wide">Category</span>
                              <p className="text-on-surface-variant font-medium">{specs.category}</p>
                            </div>

                            <div>
                              <span className="font-bold text-on-surface text-[11px] uppercase tracking-wide">SKU</span>
                              <p className="font-mono text-on-surface-variant text-[11px]">{specs.sku}</p>
                            </div>

                            <div>
                              <span className="font-bold text-on-surface text-[11px] uppercase tracking-wide">Customer Rating</span>
                              <p className="text-on-surface-variant italic">
                                {specs.rating}
                              </p>
                            </div>

                            <div>
                              <span className="font-bold text-on-surface text-[11px] uppercase tracking-wide">Connectivity</span>
                              <p className="text-on-surface-variant">{specs.connectivity}</p>
                            </div>

                            <div>
                              <span className="font-bold text-on-surface text-[11px] uppercase tracking-wide">Build / Styling</span>
                              <p className="text-on-surface-variant">{specs.materialOrBuild}</p>
                            </div>

                            {/* Key Features */}
                            <div>
                              <span className="font-bold text-on-surface text-[11px] uppercase tracking-wide">Key Features</span>
                              <ul className="mt-1 space-y-1">
                                {specs.keyFeatures.map((feat, idx) => (
                                  <li key={idx} className="flex items-start gap-1.5 text-on-surface-variant">
                                    <Check className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                                    <span>{feat}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>

                            {/* Pros */}
                            <div className="rounded-lg bg-emerald-50/60 p-2 border border-emerald-200/60">
                              <span className="font-bold text-emerald-800 text-[10px] uppercase flex items-center gap-1">
                                <ThumbsUp className="h-3 w-3" /> Advantages
                              </span>
                              <ul className="mt-1 space-y-0.5 text-[11px] text-emerald-950">
                                {specs.pros.map((pro, i) => (
                                  <li key={i}>• {pro}</li>
                                ))}
                              </ul>
                            </div>

                            {/* Cons */}
                            <div className="rounded-lg bg-surface-container-low p-2 border border-surface-container">
                              <span className="font-bold text-on-surface-variant text-[10px] uppercase flex items-center gap-1">
                                <ThumbsDown className="h-3 w-3" /> Disadvantages
                              </span>
                              <ul className="mt-1 space-y-0.5 text-[11px] text-on-surface-variant">
                                {specs.cons.map((con, i) => (
                                  <li key={i}>• {con}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-4 pt-3 border-t border-surface-container space-y-2">
                          <button
                            type="button"
                            onClick={() => {
                              closeAssistant()
                              onNavigateProduct?.(product.id)
                            }}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-surface-container bg-surface-container-low py-2 text-xs font-bold text-on-surface hover:bg-surface-container-high transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5 text-primary" />
                            <span>View Details</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleAddToCart(product.id)}
                            disabled={addingId === product.id}
                            className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-bold text-on-primary shadow-xs hover:bg-primary/90 disabled:opacity-50 transition-colors"
                          >
                            <ShoppingBag className="h-3.5 w-3.5" />
                            <span>{addingId === product.id ? "Adding…" : "Add to Cart"}</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Informative Note */}
              <div className="flex items-center gap-2 rounded-xl bg-surface-container-low p-3 text-xs text-on-surface-variant border border-surface-container/60">
                <Info className="h-4 w-4 text-primary shrink-0" />
                <span>
                  <strong>Data Integrity Guarantee:</strong> Specifications are extracted strictly from actual PATRONET catalogue data. Where information is unrecorded in the catalogue, it is honestly represented as &quot;Not available&quot;.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
