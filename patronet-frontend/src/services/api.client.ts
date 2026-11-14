/**
 * Centralized HTTP Client
 * Uses VITE_API_BASE_URL environment variable.
 */

import {
  ApiError,
  formatApiErrorDetail,
  normalizeApiError,
} from "./api.errors"
import { clearStoredToken } from "./token.store"

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
  if (configuredBaseUrl) {
    const trimmed = configuredBaseUrl.replace(/\/+$/, "")
    if (import.meta.env.DEV && trimmed.startsWith("http://localhost:")) {
      return trimmed.replace("http://localhost:", "http://127.0.0.1:")
    }
    return trimmed
  }

  if (import.meta.env.DEV) {
    return "http://127.0.0.1:8000"
  }

  throw new ApiError(
    0,
    "CONFIG_ERROR",
    "VITE_API_BASE_URL environment variable is missing. " +
    "Please configure VITE_API_BASE_URL in your environment (e.g. .env.local) to point to the backend API."
  )
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

    const responseText = await response.text()
    if (!response.ok) {
      if (response.status === 401) {
        try {
          clearStoredToken()
        } catch {
          console.warn("[PATRONET Auth] Could not clear an expired browser session.")
        }
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("patronet:auth-expired"))
        }
      }
      let errorDetail: unknown = responseText || null
      try {
        errorDetail = responseText ? JSON.parse(responseText) : null
      } catch {
        // Keep plain-text error bodies as details.
      }

      const detail =
        typeof errorDetail === "object" && errorDetail !== null && "detail" in errorDetail
          ? (errorDetail as { detail: unknown }).detail
          : errorDetail
      const errorMessage =
        formatApiErrorDetail(detail) ??
        `Request failed (${response.status}). Please try again.`

      throw new ApiError(response.status, response.statusText, errorMessage, errorDetail)
    }

    if (response.status === 204 || !responseText.trim()) {
      return undefined as T
    }

    try {
      return JSON.parse(responseText) as T
    } catch {
      throw new ApiError(
        502,
        "INVALID_RESPONSE",
        "The server returned an unreadable response."
      )
    }
  } catch (error) {
    throw normalizeApiError(error)
  }
}
