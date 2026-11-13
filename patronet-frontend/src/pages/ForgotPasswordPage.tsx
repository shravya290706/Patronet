import { useState, type FormEvent } from "react"
import { AuthLayout } from "@/components/auth"
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react"

interface ForgotPasswordPageProps {
  onNavigateHome?: () => void
  onNavigateLogin?: () => void
}

export function ForgotPasswordPage({
  onNavigateHome,
  onNavigateLogin,
}: ForgotPasswordPageProps) {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    type: "info" | "error" | "success"
    text: string
  } | null>(null)

  const validate = () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError("Email address is required.")
      return false
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError("Please enter a valid email address.")
      return false
    }
    setError(null)
    return true
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setStatusMessage(null)

    if (!validate()) {
      return
    }

    setIsSubmitting(true)

    // No backend password reset endpoint exists.
    setTimeout(() => {
      setIsSubmitting(false)
      setStatusMessage({
        type: "info",
        text: "Password reset is not yet available. Please contact support or create a new account.",
      })
    }, 400)
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your verified email address and we'll send you instructions to reset your account password."
      backHref="#login"
      backLabel="Back to sign in"
      onBackClick={onNavigateLogin || onNavigateHome}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4 sm:space-y-5">
        {/* Status Feedback Banner */}
        {statusMessage && (
          <div
            role="status"
            className={`p-3.5 rounded-lg border flex items-start gap-3 text-body-sm ${
              statusMessage.type === "success"
                ? "bg-secondary-container/20 border-secondary-container text-on-surface"
                : "bg-surface-container border-outline-variant/60 text-on-surface"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="h-5 w-5 text-secondary flex-shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            )}
            <p className="leading-snug">{statusMessage.text}</p>
          </div>
        )}

        {/* Email Field */}
        <div>
          <label
            htmlFor="reset-email"
            className="block text-label-md font-heading font-medium text-on-surface mb-1.5"
          >
            Email address
          </label>
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError(null)
            }}
            placeholder="name@example.com"
            autoComplete="email"
            className={`w-full h-11 px-3.5 rounded-lg border bg-surface-container-lowest text-body-md text-on-surface placeholder:text-outline/70 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
              error
                ? "border-error focus:ring-error/20 focus:border-error"
                : "border-outline-variant hover:border-outline"
            }`}
          />
          {error && (
            <p className="mt-1 text-xs text-error font-medium">{error}</p>
          )}
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
              <span>Submitting request...</span>
            </>
          ) : (
            <span>Send Reset Instructions</span>
          )}
        </button>

        {/* Return to Login */}
        <div className="pt-4 text-center border-t border-outline-variant/60">
          <a
            href="#login"
            onClick={(e) => {
              if (onNavigateLogin) {
                e.preventDefault()
                onNavigateLogin()
              }
            }}
            className="inline-flex items-center gap-1.5 font-heading font-semibold text-body-sm text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Sign In</span>
          </a>
        </div>
      </form>
    </AuthLayout>
  )
}
