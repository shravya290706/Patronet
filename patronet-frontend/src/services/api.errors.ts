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

function humanizeField(value: unknown): string {
  const field = Array.isArray(value) ? String(value[value.length - 1] ?? "") : String(value ?? "")
  const labels: Record<string, string> = {
    address_id: "Delivery address",
    category_id: "Category",
    email: "Email address",
    full_name: "Full name",
    max_price: "Maximum price",
    min_price: "Minimum price",
    password: "Password",
    phone: "Phone number",
    product_id: "Product",
    quantity: "Quantity",
  }
  return labels[field] ?? field.replaceAll("_", " ")
}

export function formatApiErrorDetail(detail: unknown): string | undefined {
  if (typeof detail === "string") {
    return detail
  }

  if (!Array.isArray(detail)) {
    return undefined
  }

  const messages = detail.map((entry) => {
    if (typeof entry !== "object" || entry === null) return undefined
    const error = entry as { loc?: unknown; msg?: unknown }
    const field = humanizeField(error.loc)
    const message = typeof error.msg === "string" ? error.msg : ""

    if (/field required/i.test(message)) return `${field} is required.`
    if (/valid email/i.test(message)) return "Enter a valid email address."
    const minLength = message.match(/at least (\d+) characters/i)
    if (minLength) return `${field} must be at least ${minLength[1]} characters.`
    const maxLength = message.match(/at most (\d+) characters/i)
    if (maxLength) return `${field} must be no more than ${maxLength[1]} characters.`
    if (/valid uuid/i.test(message)) return `Choose a valid ${field.toLowerCase()}.`
    if (/greater than 0/i.test(message)) return `${field} must be greater than zero.`
    if (/must be >=/i.test(message)) return "Maximum price must be greater than or equal to minimum price."
    return field ? `Check ${field.toLowerCase()}.` : "Check the submitted information."
  }).filter((message): message is string => Boolean(message))

  return [...new Set(messages)].join(" ") || "Check the submitted information."
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

  if (err instanceof DOMException && err.name === "AbortError") {
    return new ApiError(0, "ABORTED", "The request was interrupted. Please try again.")
  }

  if (err instanceof Error) {
    return new ApiError(500, "CLIENT_ERROR", err.message)
  }

  return new ApiError(500, "UNKNOWN_ERROR", "An unexpected error occurred while communicating with the service.")
}
