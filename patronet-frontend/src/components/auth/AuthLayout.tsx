import { type ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { AuthBrandPanel } from "./AuthBrandPanel"
import patronetLogo from "@/assets/brand/patronet-logo-cropped.png"

interface AuthLayoutProps {
  children: ReactNode
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  onBackClick?: () => void
}

export function AuthLayout({
  children,
  title,
  subtitle,
  backHref = "#",
  backLabel = "Back to marketplace",
  onBackClick,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-[#f8f9fb] flex flex-col justify-center items-center py-6 sm:py-10 px-4 sm:px-6 lg:px-8">
      {/* Back to Marketplace Quick Navigation */}
      <div className="w-full max-w-5xl mb-4 sm:mb-6 flex items-center justify-between">
        <a
          href={backHref}
          onClick={(e) => {
            if (onBackClick) {
              e.preventDefault()
              onBackClick()
            }
          }}
          className="inline-flex items-center gap-2 text-label-md font-heading font-medium text-on-surface-variant hover:text-primary transition-colors group cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          <span>{backLabel}</span>
        </a>

        {/* Brand mark on mobile */}
        <div className="lg:hidden flex items-center">
          <a
            href="#"
            className="flex items-center rounded-lg bg-[#042373] px-2.5 py-1 shadow-xs"
            aria-label="PATRONET Home"
          >
            <img
              src={patronetLogo}
              alt="PATRONET"
              className="h-6 w-auto object-contain"
            />
          </a>
        </div>
      </div>

      {/* Main Dual-Panel Auth Container */}
      <div className="w-full max-w-5xl bg-surface-container-lowest rounded-2xl shadow-card border border-outline-variant/60 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[580px] lg:min-h-[640px]">
        {/* Left Side: Brand & Value Proposition Panel (Hidden on small mobile, visible on desktop) */}
        <div className="hidden lg:block lg:col-span-5 relative">
          <AuthBrandPanel />
        </div>

        {/* Right Side: Clean Authentication Form Panel */}
        <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
          <div className="w-full max-w-md mx-auto">
            {/* Form Header */}
            <div className="mb-6 sm:mb-8 text-center sm:text-left">
              <h1 className="text-display-sm sm:text-headline-lg font-heading font-bold text-on-surface tracking-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-2 text-body-md text-on-surface-variant leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>

            {/* Form Content */}
            {children}
          </div>
        </div>
      </div>

      {/* Bottom Footer Note */}
      <div className="mt-8 text-center text-xs text-outline font-sans">
        <p>© {new Date().getFullYear()} PATRONET. All rights reserved.</p>
      </div>
    </div>
  )
}
