/**
 * Centralized HTTP Client
 * Uses VITE_API_BASE_URL environment variable.
 */

import { ApiError, normalizeApiError } from "./api.errors"

// Check environment configuration explicitly
const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim()

if (!configuredBaseUrl) {
  const warningMsg =
    "[PATRONET API Config] VITE_API_BASE_URL is not defined in the environment. " +
    "API requests will fail until VITE_API_BASE_URL is configured (e.g., in .env.local). " +
    "Please refer to .env.example."

  if (import.meta.env.DEV) {
    console.warn(warningMsg)
  } else {
    console.error(warningMsg)
  }
}

/**
 * Resolves the active API base URL.
 * Throws an explicit configuration error if missing in production or when an API call is attempted.
 */
export function getApiBaseUrl(): string {
  if (!configuredBaseUrl) {
    throw new ApiError(
      0,
      "CONFIG_ERROR",
      "VITE_API_BASE_URL environment variable is missing. " +
      "Please configure VITE_API_BASE_URL in your environment (e.g. .env.local) to point to the backend API."
    )
  }
  return configuredBaseUrl.replace(/\/+$/, "")
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>
}

/**
 * Builds URL with query parameters, cleanly omitting undefined or null entries.
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  const baseUrl = getApiBaseUrl()
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
  const fullUrl = new URL(`${baseUrl}${cleanEndpoint}`)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        fullUrl.searchParams.append(key, String(value))
      }
    })
  }

  return fullUrl.toString()
}

/**
 * Core JSON fetch wrapper with robust error handling.
 */
export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...restOptions } = options

  try {
    const url = buildUrl(endpoint, params)
    const response = await fetch(url, {
      ...restOptions,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...headers,
      },
    })

    if (!response.ok) {
      let errorDetail: unknown = null
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`

      try {
        errorDetail = await response.json()
        if (typeof errorDetail === "object" && errorDetail !== null && "detail" in errorDetail) {
          const d = (errorDetail as { detail: unknown }).detail
          errorMessage = typeof d === "string" ? d : JSON.stringify(d)
        }
      } catch {
        // Response was not JSON
      }

      throw new ApiError(response.status, response.statusText, errorMessage, errorDetail)
    }

    return (await response.json()) as T
  } catch (error) {
    throw normalizeApiError(error)
  }
}
