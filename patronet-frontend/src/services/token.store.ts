/**
 * JWT Token Store
 * Persists the access token for this tab or across browser sessions.
 */

const TOKEN_KEY = "patronet_access_token"

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY)
  } catch (error) {
    throw new Error("Browser storage is unavailable; your session cannot be restored.", {
      cause: error,
    })
  }
}

export function setStoredToken(token: string, rememberMe = false): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
    const storage = rememberMe ? localStorage : sessionStorage
    storage.setItem(TOKEN_KEY, token)
  } catch (error) {
    throw new Error("Unable to save your session in this browser.", { cause: error })
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(TOKEN_KEY)
  } catch (error) {
    throw new Error("Unable to clear the saved session from this browser.", {
      cause: error,
    })
  }
}

export function isAuthenticated(): boolean {
  return getStoredToken() !== null
}

/** Returns Authorization header object if a token is stored, otherwise empty object. */
export function authHeaders(): Record<string, string> {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}
