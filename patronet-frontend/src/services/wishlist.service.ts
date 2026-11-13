import { apiClient } from "./api.client"
import { authHeaders } from "./token.store"
import type { ApiWishlistResponse } from "@/types/api.types"

export async function getWishlist(): Promise<ApiWishlistResponse> {
  return apiClient<ApiWishlistResponse>("/api/wishlist", {
    headers: authHeaders(),
  })
}

export async function addWishlistItem(productId: string): Promise<void> {
  await apiClient<unknown>(`/api/wishlist/${encodeURIComponent(productId)}`, {
    method: "POST",
    headers: authHeaders(),
  })
}

export async function removeWishlistItem(productId: string): Promise<void> {
  await apiClient<void>(`/api/wishlist/${encodeURIComponent(productId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
}
