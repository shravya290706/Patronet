/**
 * Typed API Error Hierarchy
 */

export class ApiError extends Error {
  public readonly status: number
  public readonly statusText: string
  public readonly detail?: unknown

  constructor(status: number, statusText: string, message: string, detail?: unknown) {
    super(message)
    this.name = "ApiError"
    this.status = status
    this.statusText = statusText
    this.detail = detail
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  get isUnauthorized(): boolean {
    return this.status === 401 || this.status === 403
  }

  get isServerError(): boolean {
    return this.status >= 500
  }
}

/**
 * Normalizes any caught error into a structured ApiError.
 */
export function normalizeApiError(err: unknown): ApiError {
  if (err instanceof ApiError) {
    return err
  }

  if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
    return new ApiError(0, "NETWORK_ERROR", "Unable to connect to the backend server. Please verify your connection or backend status.")
  }

  if (err instanceof Error) {
    return new ApiError(500, "CLIENT_ERROR", err.message)
  }

  return new ApiError(500, "UNKNOWN_ERROR", "An unexpected error occurred while communicating with the service.")
}
