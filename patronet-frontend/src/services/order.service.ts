import { apiClient } from "./api.client"
import { authHeaders } from "./token.store"
import type {
  ApiCancelPaymentRequest,
  ApiCancelPaymentResponse,
  ApiCheckoutRequest,
  ApiInitiateCheckoutRequest,
  ApiInitiateCheckoutResponse,
  ApiOrderResponse,
  ApiPaginatedOrders,
  ApiVerifyPaymentRequest,
} from "@/types/api.types"

/** Initiates checkout: locks items, applies gift card, and creates pending order + Razorpay order */
export async function initiateCheckout(
  payload: ApiInitiateCheckoutRequest
): Promise<ApiInitiateCheckoutResponse> {
  return apiClient<ApiInitiateCheckoutResponse>("/api/orders/initiate", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: authHeaders(),
  })
}

/** Verifies Razorpay payment signature on backend, deducts stock, and finalizes the order */
export async function verifyPayment(
  payload: ApiVerifyPaymentRequest
): Promise<ApiOrderResponse> {
  return apiClient<ApiOrderResponse>("/api/orders/verify-payment", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: authHeaders(),
  })
}

/** Cancels a pending payment attempt cleanly without deducting stock or clearing cart */
export async function cancelPayment(
  payload: ApiCancelPaymentRequest
): Promise<ApiCancelPaymentResponse> {
  return apiClient<ApiCancelPaymentResponse>("/api/orders/cancel-payment", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: authHeaders(),
  })
}

/** Preserved endpoint for backwards compatibility in test environments */
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
