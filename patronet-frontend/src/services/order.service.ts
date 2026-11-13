import { apiClient } from "./api.client"
import { authHeaders } from "./token.store"
import type {
  ApiCheckoutRequest,
  ApiOrderResponse,
  ApiPaginatedOrders,
} from "@/types/api.types"

export async function checkoutOrder(
  payload: ApiCheckoutRequest
): Promise<ApiOrderResponse> {
  return apiClient<ApiOrderResponse>("/api/orders/checkout", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: authHeaders(),
  })
}

export async function getOrders(
  page = 1,
  pageSize = 20
): Promise<ApiPaginatedOrders> {
  return apiClient<ApiPaginatedOrders>("/api/orders", {
    params: { page, page_size: pageSize },
    headers: authHeaders(),
  })
}

export async function getOrder(orderId: string): Promise<ApiOrderResponse> {
  return apiClient<ApiOrderResponse>(`/api/orders/${encodeURIComponent(orderId)}`, {
    headers: authHeaders(),
  })
}
