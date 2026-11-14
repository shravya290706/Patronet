import { apiClient } from "./api.client"
import { authHeaders } from "./token.store"
import type {
  ApiDemoGiftCard,
  ApiGiftCardValidateRequest,
  ApiGiftCardValidateResponse,
} from "@/types/api.types"

/** Default static demo gift cards for simulated presentation */
export const DEFAULT_DEMO_GIFT_CARDS: ApiDemoGiftCard[] = [
  {
    code: "PATRONET500",
    balance: "500.00",
    description: "PATRONET ₹500 Welcome Voucher",
  },
  {
    code: "FESTIVE1000",
    balance: "1000.00",
    description: "PATRONET ₹1,000 Festive Gift Card",
  },
  {
    code: "DEMO250",
    balance: "250.00",
    description: "PATRONET ₹250 Demo Voucher",
  },
]

/**
 * Validates gift card code and computes applicable deduction.
 * Tries the backend endpoint first; if unavailable, falls back to the local demo vouchers.
 */
export async function validateGiftCard(
  payload: ApiGiftCardValidateRequest
): Promise<ApiGiftCardValidateResponse> {
  const normCode = (payload.code || "").trim().toUpperCase()
  const subtotal = Number(payload.cart_subtotal || 0)

  try {
    return await apiClient<ApiGiftCardValidateResponse>("/api/gift-cards/validate", {
      method: "POST",
      body: JSON.stringify({ code: normCode, cart_subtotal: subtotal }),
      headers: authHeaders(),
    })
  } catch {
    // Client-side fallback for demo reliability
    const match = DEFAULT_DEMO_GIFT_CARDS.find((card) => card.code === normCode)
    if (!match) {
      return {
        valid: false,
        code: normCode,
        current_balance: "0.00",
        applicable_amount: "0.00",
        message: "Invalid gift card code. Try PATRONET500, FESTIVE1000, or DEMO250.",
      }
    }
    const balanceNum = Number(match.balance)
    const applicableNum = Math.min(balanceNum, subtotal)
    return {
      valid: true,
      code: match.code,
      current_balance: match.balance,
      applicable_amount: applicableNum.toFixed(2),
      description: match.description,
      message: `Demo gift card applied: ₹${applicableNum.toFixed(2)} discount.`,
    }
  }
}

/** Returns sample demo gift cards for quick interactive testing */
export async function getDemoGiftCards(): Promise<ApiDemoGiftCard[]> {
  try {
    const cards = await apiClient<ApiDemoGiftCard[]>("/api/gift-cards/demo-cards", {
      headers: authHeaders(),
    })
    return cards.length ? cards : DEFAULT_DEMO_GIFT_CARDS
  } catch {
    return DEFAULT_DEMO_GIFT_CARDS
  }
}
