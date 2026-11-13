/**
 * Auth Service
 * Connects to POST /api/auth/register, POST /api/auth/login, GET /api/auth/me.
 */

import { apiClient } from "./api.client"
import { normalizeApiError } from "./api.errors"
import {
  setStoredToken,
  clearStoredToken,
  authHeaders,
  getStoredToken,
} from "./token.store"
import type {
  ApiRegisterRequest,
  ApiLoginRequest,
  ApiAccessTokenResponse,
  ApiCustomerProfile,
} from "@/types/api.types"

export interface LoginCredentials {
  email: string
  password: string
  rememberMe?: boolean
}

export interface RegisterCredentials {
  fullName: string
  email: string
  mobile: string
  password: string
  confirmPassword?: string
  acceptTerms: boolean
}

export interface ForgotPasswordRequest {
  email: string
}

export interface AuthResponse {
  success: boolean
  message?: string
  user?: {
    id: string
    fullName: string
    email: string
    mobile?: string
  }
  token?: string
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const payload: ApiLoginRequest = {
      email: credentials.email.trim(),
      password: credentials.password,
    }

    const response = await apiClient<ApiAccessTokenResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    })

    setStoredToken(response.access_token, credentials.rememberMe)

    let profile: ApiCustomerProfile
    try {
      profile = await apiClient<ApiCustomerProfile>("/api/auth/me", {
        headers: authHeaders(),
      })
    } catch (error) {
      clearStoredToken()
      throw error
    }

    return {
      success: true,
      token: response.access_token,
      user: {
        id: profile.id,
        fullName: profile.name,
        email: profile.email,
        mobile: profile.phone ?? undefined,
      },
    }
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const payload: ApiRegisterRequest = {
      name: credentials.fullName.trim(),
      email: credentials.email.trim(),
      password: credentials.password,
      phone: credentials.mobile.trim() || null,
    }

    const profile = await apiClient<ApiCustomerProfile>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    })

    return {
      success: true,
      message: "Account created successfully. Please sign in.",
      user: {
        id: profile.id,
        fullName: profile.name,
        email: profile.email,
        mobile: profile.phone ?? undefined,
      },
    }
  }

  async forgotPassword(request: ForgotPasswordRequest): Promise<AuthResponse> {
    void request
    // No backend endpoint exists for password reset.
    return {
      success: false,
      message:
        "Password reset is not yet available. Please contact support.",
    }
  }

  async getProfile(): Promise<ApiCustomerProfile | null> {
    if (!getStoredToken()) return null
    try {
      return await apiClient<ApiCustomerProfile>("/api/auth/me", {
        headers: authHeaders(),
      })
    } catch (error) {
      const normalized = normalizeApiError(error)
      if (normalized.isUnauthorized) {
        clearStoredToken()
        return null
      }
      throw normalized
    }
  }

  logout(): void {
    clearStoredToken()
  }
}

export const authService = new AuthService()
