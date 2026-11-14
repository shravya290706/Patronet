import { getProducts } from "@/services/product.service"
import { searchProducts } from "@/services/search.service"
import { mapApiProductToCard } from "@/services/mappers/product.mapper"
import type { UiProductCardModel } from "@/types/ui.types"
import { mockFeaturedProducts, mockNewArrivals } from "@/mocks/products.mock"

export interface ExtractedQueryIntent {
  budget: number | null
  category: string | null
  usage: string | null
  brand: string | null
  keywords: string[]
  rawText: string
}

export interface RecommendedProductItem {
  product: UiProductCardModel
  whyItMatches: string
  matchScore: number
  matchedSpecs: string[]
}

export interface AssistantResponse {
  messageText: string
  recommendations: RecommendedProductItem[]
  suggestedFollowUps: string[]
  isHonestUnavailable: boolean
}

// Category keyword mappings for intent extraction
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  "Audio & Sound": ["headphone", "headphones", "earphone", "earphones", "earbuds", "audio", "sound", "speaker", "speakers", "anc"],
  "Wearables": ["watch", "smartwatch", "fitness tracker", "band", "chrono", "wrist"],
  "Computing": ["laptop", "pc", "computer", "keyboard", "mouse", "monitor", "display", "mechanical"],
  "Displays": ["monitor", "display", "screen", "curved", "4k"],
  "Appliances": ["refrigerator", "fridge", "oven", "microwave", "washing machine", "ac", "appliance", "appliances"],
  "Electronics": ["gadget", "device", "phone", "mobile", "smartphone", "charger", "powerbank", "cable"],
  "Fashion": ["shirt", "tshirt", "jeans", "dress", "jacket", "shoes", "sneakers", "fashion", "apparel"],
  "Grocery": ["food", "snack", "grocery", "grain", "tea", "coffee", "rice", "flour"],
  "Sports & Fitness": ["gym", "workout", "fitness", "yoga", "dumbbell", "exercise", "sports"],
}

// Usage keyword mappings
const USAGE_KEYWORDS: Record<string, string[]> = {
  "programming & coding": ["programming", "coding", "developer", "development", "software", "code"],
  "college & studying": ["college", "study", "studying", "student", "school", "exam", "reading"],
  "office & work": ["work", "office", "professional", "business", "meeting", "productivity"],
  "gaming": ["gaming", "game", "games", "gamer", "fps"],
  "family & home": ["family", "home", "household", "kids", "children"],
  "travel & outdoor": ["travel", "commute", "outdoor", "portable", "trip"],
}

// Known brands in PATRONET catalogue
const BRAND_KEYWORDS = [
  "sonicwave",
  "chronos",
  "matrix pro",
  "audiomatrix",
  "lumina",
  "apple",
  "sony",
  "samsung",
  "dell",
  "hp",
  "lenovo",
  "boat",
  "noise",
  "logitech",
]

/**
 * Parses user input in natural language to extract structured query intent.
 */
export function parseUserQuery(query: string): ExtractedQueryIntent {
  const clean = query.trim().toLowerCase()

  // 1. Extract Budget (e.g. ₹60,000, 60k, 60000, under 30000, below 15000)
  let budget: number | null = null

  // Check for "k" notation like "60k" or "30k"
  const kMatch = clean.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)\s*k\b/i)
  if (kMatch) {
    budget = Math.round(parseFloat(kMatch[1]) * 1000)
  } else {
    // Check for standard numbers like 60,000 or 60000
    const numMatch = clean.match(/(?:₹|rs\.?|inr|under|below|budget|within|pocket)?\s*(\d{1,3}(?:,\d{3})+|\d{3,7})/i)
    if (numMatch) {
      const parsed = parseInt(numMatch[1].replace(/,/g, ""), 10)
      if (parsed >= 100 && parsed <= 500000) {
        budget = parsed
      }
    }
  }

  // 2. Extract Category
  let category: string | null = null
  for (const [catName, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => clean.includes(k))) {
      category = catName
      break
    }
  }

  // 3. Extract Intended Usage
  let usage: string | null = null
  for (const [usageName, keywords] of Object.entries(USAGE_KEYWORDS)) {
    if (keywords.some((k) => clean.includes(k))) {
      usage = usageName
      break
    }
  }

  // 4. Extract Brand Preference
  let brand: string | null = null
  for (const b of BRAND_KEYWORDS) {
    if (clean.includes(b)) {
      brand = b.charAt(0).toUpperCase() + b.slice(1)
      break
    }
  }

  // 5. General search keywords (excluding common filler words)
  const stopWords = new Set([
    "hey", "buddy", "i", "need", "want", "suggest", "me", "a", "an", "the", "in", "my", "pocket",
    "have", "ive", "i've", "for", "purpose", "purposes", "with", "and", "or", "which", "product",
    "would", "you", "good", "really", "give", "please", "can", "tell",
  ])
  const words = clean.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w))

  return {
    budget,
    category,
    usage,
    brand,
    keywords: words,
    rawText: query,
  }
}

/**
 * Searches the actual PATRONET catalogue and generates intelligent recommendations.
 */
export async function getRecommendationsForQuery(
  rawQuery: string,
  allCatalogueProducts?: UiProductCardModel[]
): Promise<AssistantResponse> {
  const intent = parseUserQuery(rawQuery)

  // Retrieve products from actual backend search or fallback to loaded catalogue
  let candidates: UiProductCardModel[] = []

  try {
    if (intent.keywords.length > 0) {
      const searchRes = await searchProducts({
        query: intent.keywords.slice(0, 3).join(" "),
        maxPrice: intent.budget ? intent.budget * 1.15 : undefined,
      })
      if (searchRes.items.length > 0) {
        candidates = searchRes.items
      }
    }

    if (candidates.length === 0) {
      const productRes = await getProducts({
        max_price: intent.budget ? intent.budget * 1.15 : undefined,
        page_size: 24,
      })
      candidates = (productRes.results || []).map(mapApiProductToCard)
    }
  } catch {
    // If backend endpoint is offline, use loaded mock catalogue items
    candidates = allCatalogueProducts && allCatalogueProducts.length > 0
      ? allCatalogueProducts
      : [...mockFeaturedProducts, ...mockNewArrivals]
  }

  // Fallback to local mock if still empty
  if (candidates.length === 0) {
    candidates = [...mockFeaturedProducts, ...mockNewArrivals]
  }

  // If specific brand requested, prioritize brand matches
  if (intent.brand) {
    const brandMatches = candidates.filter(
      (p) => (p.brand || "").toLowerCase().includes(intent.brand!.toLowerCase())
    )
    if (brandMatches.length > 0) {
      candidates = [...brandMatches, ...candidates.filter((p) => !brandMatches.includes(p))]
    }
  }

  // Score and rank candidates
  const scoredItems: RecommendedProductItem[] = candidates
    .map((product) => {
      let score = 50
      const pName = product.name.toLowerCase()
      const pCat = (product.categoryName || "").toLowerCase()
      const matchedSpecs: string[] = []

      // Category matching
      if (intent.category) {
        const catKeywords = CATEGORY_KEYWORDS[intent.category] || []
        const matchesCategory = catKeywords.some((k) => pName.includes(k) || pCat.includes(k))
        if (matchesCategory) {
          score += 35
          matchedSpecs.push(intent.category)
        }
      }

      // Keyword matching
      intent.keywords.forEach((kw) => {
        if (pName.includes(kw)) {
          score += 15
          matchedSpecs.push(`Matched "${kw}"`)
        }
      })

      // Budget scoring
      if (intent.budget) {
        if (product.price <= intent.budget) {
          // Rewarded for being under budget
          score += 25
          const saved = intent.budget - product.price
          if (saved > 0) {
            matchedSpecs.push(`₹${saved.toLocaleString("en-IN")} under your budget`)
          } else {
            matchedSpecs.push("Fits within your exact budget")
          }
        } else if (product.price <= intent.budget * 1.1) {
          // Slight stretch (within 10%)
          score += 5
          matchedSpecs.push(`Just ₹${(product.price - intent.budget).toLocaleString("en-IN")} over budget`)
        } else {
          score -= 30
        }
      }

      // Usage matching
      if (intent.usage) {
        const usageKeys = USAGE_KEYWORDS[intent.usage] || []
        const hasUsage = usageKeys.some((k) => pName.includes(k))
        if (hasUsage) {
          score += 20
          matchedSpecs.push(`Optimized for ${intent.usage}`)
        }
      }

      // Generate "Why it matches"
      let whyItMatches = ""
      if (intent.budget && product.price <= intent.budget) {
        whyItMatches = `Priced at ₹${product.price.toLocaleString("en-IN")} (within your ₹${intent.budget.toLocaleString("en-IN")} budget).`
      } else {
        whyItMatches = `Competitive price at ₹${product.price.toLocaleString("en-IN")}.`
      }

      if (product.brand) {
        whyItMatches += ` Authentic ${product.brand} build.`
      }

      if (intent.usage) {
        whyItMatches += ` Well-suited for ${intent.usage}.`
      }

      return {
        product,
        matchScore: score,
        whyItMatches,
        matchedSpecs,
      }
    })
    .sort((a, b) => b.matchScore - a.matchScore)

  // Pick top recommendations (2 to 3 products)
  const topRecommendations = scoredItems.slice(0, 3)

  // Construct helpful assistant response message
  let messageText = ""
  let isHonestUnavailable = false

  if (topRecommendations.length === 0 || topRecommendations[0].matchScore < 40) {
    isHonestUnavailable = true
    messageText = `I searched our catalogue for "${rawQuery}", but I couldn't find an exact match that fulfills all criteria. Our store currently has verified inventory in Audio & Sound, Wearables, Computing, and Displays. Here are some of our popular catalogue items you might consider:`
  } else {
    const primary = topRecommendations[0]
    const budgetNote = intent.budget ? ` within ₹${intent.budget.toLocaleString("en-IN")}` : ""
    const usageNote = intent.usage ? ` for ${intent.usage}` : ""

    messageText = `I found ${topRecommendations.length} excellent match${topRecommendations.length > 1 ? "es" : ""} in the PATRONET catalogue${budgetNote}${usageNote}! My top recommendation is "${primary.product.name}". Here is the curated breakdown:`
  }

  // Construct suggested follow-ups
  const suggestedFollowUps: string[] = []
  if (intent.budget) {
    suggestedFollowUps.push(`Show options under ₹${Math.round(intent.budget * 0.7).toLocaleString("en-IN")}`)
  } else {
    suggestedFollowUps.push("Show budget options under ₹10,000")
  }
  if (!intent.brand) {
    suggestedFollowUps.push("Filter by specific brand")
  }
  suggestedFollowUps.push("Compare these top recommendations")

  return {
    messageText,
    recommendations: topRecommendations,
    suggestedFollowUps,
    isHonestUnavailable,
  }
}
