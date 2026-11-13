/**
 * Cart Service
 * Connects to GET/POST/PATCH/DELETE /api/cart endpoints.
 * All requests require a Bearer token.
 */

import { apiClient } from "./api.client"
import { authHeaders } from "./token.store"
import type {
  ApiCartResponse,
  ApiCartItemCreate,
  ApiCartItemUpdate,
} from "@/types/api.types"

export async function getCart(): Promise<ApiCartResponse> {
  return apiClient<ApiCartResponse>("/api/cart", {
    headers: authHeaders(),
  })
}

export async function addCartItem(payload: ApiCartItemCreate): Promise<ApiCartResponse> {
  return apiClient<ApiCartResponse>("/api/cart/items", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: authHeaders(),
  })
}

export async function updateCartItem(
  itemId: string,
  payload: ApiCartItemUpdate
): Promise<ApiCartResponse> {
  return apiClient<ApiCartResponse>(`/api/cart/items/${itemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: authHeaders(),
  })
}

export async function removeCartItem(itemId: string): Promise<void> {
  await apiClient<void>(`/api/cart/items/${itemId}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
}

export async function clearCart(): Promise<void> {
  await apiClient<void>("/api/cart", {
    method: "DELETE",
    headers: authHeaders(),
  })
}
