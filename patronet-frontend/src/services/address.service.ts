import { apiClient } from "./api.client"
import { authHeaders } from "./token.store"
import type {
  ApiAddress,
  ApiAddressCreate,
  ApiAddressUpdate,
} from "@/types/api.types"

export async function getAddresses(): Promise<ApiAddress[]> {
  return apiClient<ApiAddress[]>("/api/addresses", {
    headers: authHeaders(),
  })
}

export async function createAddress(payload: ApiAddressCreate): Promise<ApiAddress> {
  return apiClient<ApiAddress>("/api/addresses", {
    method: "POST",
    body: JSON.stringify(payload),
    headers: authHeaders(),
  })
}

export async function updateAddress(
  addressId: string,
  payload: ApiAddressUpdate
): Promise<ApiAddress> {
  return apiClient<ApiAddress>(`/api/addresses/${encodeURIComponent(addressId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
    headers: authHeaders(),
  })
}

export async function deleteAddress(addressId: string): Promise<void> {
  await apiClient<void>(`/api/addresses/${encodeURIComponent(addressId)}`, {
    method: "DELETE",
    headers: authHeaders(),
  })
}

export async function setDefaultAddress(addressId: string): Promise<ApiAddress> {
  return apiClient<ApiAddress>(
    `/api/addresses/${encodeURIComponent(addressId)}/default`,
    {
      method: "PATCH",
      headers: authHeaders(),
    }
  )
}
