import { useState, useEffect } from "react"
import patronetLogo from "@/assets/brand/patronet-logo-cropped.png"

interface BrandIntroProps {
  onComplete: () => void
}

const SESSION_STORAGE_KEY = "patronet_brand_intro_shown"

export function BrandIntro({ onComplete }: BrandIntroProps) {
  const [isFadingOut, setIsFadingOut] = useState(false)

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches

    // If user prefers reduced motion, display static screen briefly (600ms) without jarring motion,
    // rather than abruptly aborting in 0ms before the screen is ever perceived.
    const fadeDelay = prefersReducedMotion ? 600 : 1400
    const finishDelay = prefersReducedMotion ? 900 : 1850

    const fadeTimer = setTimeout(() => {
      setIsFadingOut(true)
    }, fadeDelay)

    const finishTimer = setTimeout(() => {
      sessionStorage.setItem(SESSION_STORAGE_KEY, "true")
      onComplete()
    }, finishDelay)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(finishTimer)
    }
  }, [onComplete])

  return (
    <div
      role="status"
      aria-label="Welcome to PATRONET"
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#042373] text-white transition-opacity duration-500 ease-out select-none ${
        isFadingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      <div className="flex flex-col items-center justify-center px-4 max-w-md w-full text-center">
        {/* Animated Brand Logo */}
        <div className="w-56 sm:w-72 max-w-[85vw] animate-intro-logo flex items-center justify-center">
          <img
            src={patronetLogo}
            alt="PATRONET - Unified Retail Marketplace"
            className="w-full h-auto object-contain drop-shadow-md"
          />
        </div>

        {/* Orange Accent Bar (#FE6B00 / #FF6B00) */}
        <div className="mt-4 h-1 bg-[#FF6B00] rounded-full animate-intro-line shadow-[0_0_12px_rgba(255,107,0,0.6)]" />

        {/* Brand Tagline */}
        <p className="mt-3 font-heading font-bold text-xs sm:text-sm tracking-[0.25em] sm:tracking-[0.3em] uppercase text-white/90 animate-intro-tagline">
          SHOP SMARTER. LIVE BETTER.
        </p>
      </div>
    </div>
  )
}
