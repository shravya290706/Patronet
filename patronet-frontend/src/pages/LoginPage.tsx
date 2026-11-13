import { useState, type FormEvent } from "react"
import { AuthLayout, PasswordInput } from "@/components/auth"
import { AlertCircle, Loader2 } from "lucide-react"

interface LoginPageProps {
  onNavigateHome?: () => void
  onNavigateRegister?: () => void
  onNavigateForgotPassword?: () => void
}

export function LoginPage({
  onNavigateHome,
  onNavigateRegister,
  onNavigateForgotPassword,
}: LoginPageProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)

  // Validation & interaction states
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const validate = () => {
    const nextErrors: { email?: string; password?: string } = {}
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      nextErrors.email = "Email address is required."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = "Please enter a valid email address."
    }

    if (!password) {
      nextErrors.password = "Password is required."
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    if (!validate()) {
      return
    }

    setIsSubmitting(true)

    // Simulate standard asynchronous UI validation flow before backend seam
    setTimeout(() => {
      setIsSubmitting(false)
      // Per Phase 2 architecture requirements:
      // Frontend/backend separation - do not fake login success or issue fake tokens.
      setFormError(
        "Authentication service interface ready. Live sign-in will connect to the backend authentication API."
      )
    }, 600)
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your PATRONET account to manage orders, track deliveries, and access your wishlist."
      backHref="#"
      backLabel="Back to marketplace"
      onBackClick={onNavigateHome}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
        {/* Form Error Banner */}
        {formError && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-surface-container border border-outline-variant/60 flex items-start gap-3 text-body-sm text-on-surface"
          >
            <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <p className="leading-snug">{formError}</p>
          </div>
        )}

        {/* Email Field */}
        <div>
          <label
            htmlFor="email"
            className="block text-label-md font-heading font-medium text-on-surface mb-1.5"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
            }}
            placeholder="name@example.com"
            autoComplete="email"
            className={`w-full h-11 px-3.5 rounded-lg border bg-surface-container-lowest text-body-md text-on-surface placeholder:text-outline/70 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
              errors.email
                ? "border-error focus:ring-error/20 focus:border-error"
                : "border-outline-variant hover:border-outline"
            }`}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-error font-medium">{errors.email}</p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-label-md font-heading font-medium text-on-surface"
            >
              Password
            </label>
            <a
              href="#forgot-password"
              onClick={(e) => {
                if (onNavigateForgotPassword) {
                  e.preventDefault()
                  onNavigateForgotPassword()
                }
              }}
              className="text-xs font-heading font-semibold text-primary hover:text-primary/80 transition-colors"
            >
              Forgot password?
            </a>
          </div>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
            }}
            placeholder="Enter your password"
            autoComplete="current-password"
            error={errors.password}
          />
          {errors.password && (
            <p className="mt-1 text-xs text-error font-medium">{errors.password}</p>
          )}
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-outline-variant text-primary accent-[#042373] focus:ring-primary/30"
            />
            <span className="text-body-sm text-on-surface-variant">Remember me</span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 rounded-lg bg-[#042373] hover:bg-[#243b8a] text-white font-heading font-semibold text-body-md transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Signing in...</span>
            </>
          ) : (
            <span>Sign In</span>
          )}
        </button>

        {/* Link to Registration */}
        <div className="pt-4 text-center border-t border-outline-variant/60">
          <p className="text-body-sm text-on-surface-variant">
            Don't have an account?{" "}
            <a
              href="#register"
              onClick={(e) => {
                if (onNavigateRegister) {
                  e.preventDefault()
                  onNavigateRegister()
                }
              }}
              className="font-heading font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              Create Account
            </a>
          </p>
        </div>
      </form>
    </AuthLayout>
  )
}
