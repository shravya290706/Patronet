import { useState, type FormEvent } from "react"
import { AuthLayout, PasswordInput } from "@/components/auth"
import { AlertCircle, Loader2 } from "lucide-react"

interface RegisterPageProps {
  onNavigateHome?: () => void
  onNavigateLogin?: () => void
}

export function RegisterPage({
  onNavigateHome,
  onNavigateLogin,
}: RegisterPageProps) {
  const [fullName, setFullName] = useState("")
  const [email, setEmail] = useState("")
  const [mobile, setMobile] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [acceptTerms, setAcceptTerms] = useState(false)

  // Validation & interaction states
  const [errors, setErrors] = useState<{
    fullName?: string
    email?: string
    mobile?: string
    password?: string
    confirmPassword?: string
    acceptTerms?: string
  }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const validate = () => {
    const nextErrors: typeof errors = {}

    if (!fullName.trim()) {
      nextErrors.fullName = "Full name is required."
    }

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      nextErrors.email = "Email address is required."
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      nextErrors.email = "Please enter a valid email address."
    }

    const cleanMobile = mobile.replace(/\D/g, "")
    if (!mobile.trim()) {
      nextErrors.mobile = "Mobile number is required."
    } else if (cleanMobile.length < 10) {
      nextErrors.mobile = "Please enter a valid 10-digit mobile number."
    }

    if (!password) {
      nextErrors.password = "Password is required."
    } else if (password.length < 6) {
      nextErrors.password = "Password should be at least 6 characters."
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = "Confirm password is required."
    } else if (password !== confirmPassword) {
      nextErrors.confirmPassword = "Passwords do not match."
    }

    if (!acceptTerms) {
      nextErrors.acceptTerms = "You must agree to the Terms and Privacy Policy."
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
      // Frontend/backend separation - do not simulate fake registered user.
      setFormError(
        "Registration interface ready. Live account creation will connect to the backend authentication API."
      )
    }, 600)
  }

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Join PATRONET to enjoy fast checkout, order tracking, and curated marketplace deals."
      backHref="#"
      backLabel="Back to marketplace"
      onBackClick={onNavigateHome}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
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

        {/* Full Name Field */}
        <div>
          <label
            htmlFor="fullName"
            className="block text-label-md font-heading font-medium text-on-surface mb-1"
          >
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value)
              if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined }))
            }}
            placeholder="John Doe"
            autoComplete="name"
            className={`w-full h-11 px-3.5 rounded-lg border bg-surface-container-lowest text-body-md text-on-surface placeholder:text-outline/70 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
              errors.fullName
                ? "border-error focus:ring-error/20 focus:border-error"
                : "border-outline-variant hover:border-outline"
            }`}
          />
          {errors.fullName && (
            <p className="mt-1 text-xs text-error font-medium">{errors.fullName}</p>
          )}
        </div>

        {/* Email & Mobile 2-column on wider form viewports */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Email Field */}
          <div>
            <label
              htmlFor="email"
              className="block text-label-md font-heading font-medium text-on-surface mb-1"
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

          {/* Mobile Field */}
          <div>
            <label
              htmlFor="mobile"
              className="block text-label-md font-heading font-medium text-on-surface mb-1"
            >
              Mobile number
            </label>
            <input
              id="mobile"
              type="tel"
              value={mobile}
              onChange={(e) => {
                setMobile(e.target.value)
                if (errors.mobile) setErrors((prev) => ({ ...prev, mobile: undefined }))
              }}
              placeholder="9876543210"
              autoComplete="tel"
              className={`w-full h-11 px-3.5 rounded-lg border bg-surface-container-lowest text-body-md text-on-surface placeholder:text-outline/70 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                errors.mobile
                  ? "border-error focus:ring-error/20 focus:border-error"
                  : "border-outline-variant hover:border-outline"
              }`}
            />
            {errors.mobile && (
              <p className="mt-1 text-xs text-error font-medium">{errors.mobile}</p>
            )}
          </div>
        </div>

        {/* Password & Confirm Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Password */}
          <div>
            <label
              htmlFor="password"
              className="block text-label-md font-heading font-medium text-on-surface mb-1"
            >
              Password
            </label>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
              }}
              placeholder="Create password"
              autoComplete="new-password"
              error={errors.password}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-error font-medium">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-label-md font-heading font-medium text-on-surface mb-1"
            >
              Confirm password
            </label>
            <PasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (errors.confirmPassword) setErrors((prev) => ({ ...prev, confirmPassword: undefined }))
              }}
              placeholder="Confirm password"
              autoComplete="new-password"
              error={errors.confirmPassword}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-error font-medium">{errors.confirmPassword}</p>
            )}
          </div>
        </div>

        {/* Terms & Conditions Checkbox */}
        <div className="pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => {
                setAcceptTerms(e.target.checked)
                if (errors.acceptTerms) setErrors((prev) => ({ ...prev, acceptTerms: undefined }))
              }}
              className="w-4 h-4 mt-0.5 rounded border-outline-variant text-primary accent-[#042373] focus:ring-primary/30"
            />
            <span className="text-body-sm text-on-surface-variant leading-snug">
              I agree to the{" "}
              <a href="#terms" className="text-primary font-semibold hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#privacy" className="text-primary font-semibold hover:underline">
                Privacy Policy
              </a>
              .
            </span>
          </label>
          {errors.acceptTerms && (
            <p className="mt-1.5 text-xs text-error font-medium">{errors.acceptTerms}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 rounded-lg bg-[#042373] hover:bg-[#243b8a] text-white font-heading font-semibold text-body-md transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Creating account...</span>
            </>
          ) : (
            <span>Create Account</span>
          )}
        </button>

        {/* Link to Login */}
        <div className="pt-3 text-center border-t border-outline-variant/60">
          <p className="text-body-sm text-on-surface-variant">
            Already have an account?{" "}
            <a
              href="#login"
              onClick={(e) => {
                if (onNavigateLogin) {
                  e.preventDefault()
                  onNavigateLogin()
                }
              }}
              className="font-heading font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              Sign In
            </a>
          </p>
        </div>
      </form>
    </AuthLayout>
  )
}
