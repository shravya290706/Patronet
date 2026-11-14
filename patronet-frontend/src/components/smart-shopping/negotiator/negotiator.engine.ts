export type MessageSender = "customer" | "intermediary" | "seller"

export interface NegotiationMessage {
  id: string
  sender: MessageSender
  text: string
  priceMentioned?: number
  timestamp: string
}

export type NegotiationPhase =
  | "ready"
  | "awaiting_seller"
  | "seller_countered"
  | "deal_accepted"
  | "deal_declined"

export interface NegotiationSession {
  productName: string
  originalPrice: number
  sellerName: string
  sellerRating: number
  round: number
  maxRounds: number
  lastProposedPrice: number | null
  currentSellerOffer: number
  phase: NegotiationPhase
  messages: NegotiationMessage[]
}

/**
 * Extracts numeric price proposals from natural chat messages.
 * Handles formats like: "₹55,000", "55000", "55k", "under 40k", etc.
 */
export function extractPriceFromText(text: string, originalPrice: number): number | null {
  const clean = text.toLowerCase().replace(/,/g, "")

  // Check '55k' or '55.5k'
  const kMatch = clean.match(/(?:₹|\b)(\d+(?:\.\d+)?)\s*k\b/)
  if (kMatch) {
    const val = Math.round(parseFloat(kMatch[1]) * 1000)
    if (val > 0 && val < originalPrice * 2) return val
  }

  // Check rupee or bare digits
  const numMatches = clean.match(/(?:₹|rs\.?|inr)?\s*(\d{3,7})\b/g)
  if (numMatches) {
    for (const match of numMatches) {
      const numStr = match.replace(/[^\d]/g, "")
      const val = parseInt(numStr, 10)
      if (val > 100 && val < originalPrice * 2) {
        return val
      }
    }
  }

  return null
}

/**
 * Evaluates the seller's realistic stance given the original catalogue price,
 * customer proposal, and negotiation round count.
 */
export function simulateSellerDecision(
  originalPrice: number,
  proposedPrice: number | null,
  round: number
): {
  intermediaryIntro: string
  sellerSpeech: string
  intermediaryFollowUp: string
  counterPrice: number
  isAccepted: boolean
  isHardReject: boolean
} {
  const safeOrig = Math.max(100, originalPrice)

  // Maximum realistic seller flexibility margins
  // Round 1: ~4-6%, Round 2: ~7-9%, Round 3+: ~10-12% max
  const maxDiscountPercent = Math.min(12, 4 + round * 2.5)
  const floorPrice = Math.round(safeOrig * (1 - maxDiscountPercent / 100))

  // Scenario A: Customer did not mention a price, just asked for a discount
  if (proposedPrice === null) {
    const initialConcessionPercent = Math.min(5, 3 + round)
    const offer = Math.round(safeOrig * (1 - initialConcessionPercent / 100))
    return {
      intermediaryIntro:
        "I reached out to the merchant's sales desk to check if there is room for a courtesy discount on this catalogue item.",
      sellerSpeech: `We have active demand for this unit, but we can consider offering ₹${offer.toLocaleString(
        "en-IN"
      )} (saving ₹${(safeOrig - offer).toLocaleString(
        "en-IN"
      )}) if the customer is prepared to conclude the deal now.`,
      intermediaryFollowUp: `The seller has offered ₹${offer.toLocaleString(
        "en-IN"
      )}. Would you like to accept this demo offer, propose a specific counteroffer, or negotiate further?`,
      counterPrice: offer,
      isAccepted: false,
      isHardReject: false,
    }
  }

  const requestedDiscountAmount = safeOrig - proposedPrice
  const requestedDiscountPercent = (requestedDiscountAmount / safeOrig) * 100

  // Scenario B: Customer proposed equal or higher than original price
  if (proposedPrice >= safeOrig) {
    return {
      intermediaryIntro: "Checking with the merchant regarding your price inquiry...",
      sellerSpeech: `The listed price of ₹${safeOrig.toLocaleString(
        "en-IN"
      )} is already standard for this product.`,
      intermediaryFollowUp:
        "The seller confirmed the catalogue list price. If you want a concession, feel free to propose a lower target amount.",
      counterPrice: safeOrig,
      isAccepted: false,
      isHardReject: false,
    }
  }

  // Scenario C: Customer offered a steep lowball (> 22% discount)
  if (requestedDiscountPercent > 22) {
    const counter = Math.round(safeOrig * 0.94) // Seller offers modest 6% off
    return {
      intermediaryIntro:
        "I presented your proposed offer to the seller's accounts desk for review.",
      sellerSpeech: `We cannot consider ₹${proposedPrice.toLocaleString(
        "en-IN"
      )}—that would result in a substantial net deficit against our distributor acquisition invoice. The absolute lowest we could justify on this inventory is ₹${counter.toLocaleString(
        "en-IN"
      )}.`,
      intermediaryFollowUp: `The seller declined the ${Math.round(
        requestedDiscountPercent
      )}% cut due to wholesale margin constraints, but countered at ₹${counter.toLocaleString(
        "en-IN"
      )}. Would you like to counter with a closer figure or accept?`,
      counterPrice: counter,
      isAccepted: false,
      isHardReject: true,
    }
  }

  // Scenario D: Customer proposed within acceptable seller floor
  if (proposedPrice >= floorPrice) {
    // If round 1 and customer asked for close to floor, seller might do a mild split or accept
    if (round === 1 && requestedDiscountPercent > 7) {
      const splitOffer = Math.round((proposedPrice + safeOrig * 0.95) / 2)
      return {
        intermediaryIntro:
          "I presented your figure to the merchant to see if they can approve it immediately.",
        sellerSpeech: `Your proposal of ₹${proposedPrice.toLocaleString(
          "en-IN"
        )} is tight, but we want to close this sale. How about we meet in the middle at ₹${splitOffer.toLocaleString(
          "en-IN"
        )}?`,
        intermediaryFollowUp: `The seller has offered a middle compromise of ₹${splitOffer.toLocaleString(
          "en-IN"
        )}. Would you like to accept this agreement or counter?`,
        counterPrice: splitOffer,
        isAccepted: false,
        isHardReject: false,
      }
    }

    // Direct Acceptance by seller!
    return {
      intermediaryIntro:
        "I've negotiated directly with the merchant manager on your behalf.",
      sellerSpeech: `We have reviewed the proposed amount of ₹${proposedPrice.toLocaleString(
        "en-IN"
      )}. As a gesture of goodwill, we accept your offer!`,
      intermediaryFollowUp: `Excellent news! The seller has formally approved your price of ₹${proposedPrice.toLocaleString(
        "en-IN"
      )} (saving ₹${requestedDiscountAmount.toLocaleString(
        "en-IN"
      )}). Would you like to lock in this demo deal agreement?`,
      counterPrice: proposedPrice,
      isAccepted: true,
      isHardReject: false,
    }
  }

  // Scenario E: Customer proposed below floor, but not extreme (12% - 22% off)
  const stepOffer = Math.max(
    floorPrice,
    Math.round(safeOrig * (1 - (4 + round * 2) / 100))
  )

  const replies = [
    `We understand you're shopping with a strict budget, but our logistics and warranty overheads prevent us going below ₹${stepOffer.toLocaleString(
      "en-IN"
    )}.`,
    `We appreciate the counteroffer. The store manager gave approval to stretch down to ₹${stepOffer.toLocaleString(
      "en-IN"
    )} as our best possible compromise for today.`,
    `We cannot match ₹${proposedPrice.toLocaleString(
      "en-IN"
    )}, but to help bridge the gap, ₹${stepOffer.toLocaleString(
      "en-IN"
    )} is our firm bottom line.`,
  ]
  const sellerSpeech = replies[(round - 1) % replies.length]

  return {
    intermediaryIntro:
      "I've conveyed your proposal to the seller and advocated for a favorable concession.",
    sellerSpeech,
    intermediaryFollowUp: `The seller countered at ₹${stepOffer.toLocaleString(
      "en-IN"
    )} (saving ₹${(safeOrig - stepOffer).toLocaleString(
      "en-IN"
    )}). Would you like to accept, propose another counter, or exit?`,
    counterPrice: stepOffer,
    isAccepted: false,
    isHardReject: false,
  }
}
