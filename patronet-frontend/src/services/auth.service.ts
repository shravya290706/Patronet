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

/**
 * AuthService
 * Clean architectural seam for future backend authentication endpoints.
 * In Phase 2, this serves purely as an interface definition and contract container.
 * No endpoints are mocked or assumed; requests remain isolated until backend contracts are integrated.
 */
class AuthService {
  /**
   * Future login contract seam
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    void credentials
    throw new Error(
      "AuthService.login is pending backend API implementation."
    )
  }

  /**
   * Future register contract seam
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    void credentials
    throw new Error(
      "AuthService.register is pending backend API implementation."
    )
  }

  /**
   * Future forgot password contract seam
   */
  async forgotPassword(request: ForgotPasswordRequest): Promise<AuthResponse> {
    void request
    throw new Error(
      "AuthService.forgotPassword is pending backend API implementation."
    )
  }
}

export const authService = new AuthService()
