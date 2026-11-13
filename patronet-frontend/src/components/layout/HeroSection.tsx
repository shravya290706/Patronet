import { useState } from "react"
import { ChevronLeft, ChevronRight, ArrowRight, ShieldCheck, RotateCcw, Truck, Award } from "lucide-react"
import { cn } from "@/lib/utils"

export interface HeroSlide {
  id: string
  tag: string
  title: string
  subtitle: string
  description: string
  imageUrl: string
  ctaPrimaryText: string
  ctaSecondaryText?: string
}

const defaultSlides: HeroSlide[] = [
  {
    id: "slide-1",
    tag: "Seasonal Selection",
    title: "Living & Tech Essentials",
    subtitle: "Explore Curated Home & Personal Electronics",
    description: "Discover verified electronics, computing accessories, and everyday essentials delivered across supported regions.",
    imageUrl: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=700&q=80",
    ctaPrimaryText: "Explore Catalog",
    ctaSecondaryText: "View Categories",
  },
  {
    id: "slide-2",
    tag: "Audio Collection",
    title: "Studio Audio & Sound",
    subtitle: "Acoustic Hardware & Headphones",
    description: "Explore wireless noise-cancelling headphones and studio monitoring equipment from featured audio brands.",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=700&q=80",
    ctaPrimaryText: "View Details",
    ctaSecondaryText: "Audio Collection",
  },
]

interface HeroSectionProps {
  slides?: HeroSlide[]
  onPrimaryClick?: (slideId: string) => void
  onSecondaryClick?: (slideId: string) => void
  className?: string
}

export function HeroSection({
  slides = defaultSlides,
  onPrimaryClick,
  onSecondaryClick,
  className,
}: HeroSectionProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
  const slide = slides[currentSlideIndex]

  const handlePrev = () => {
    setCurrentSlideIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentSlideIndex((prev) => (prev === slides.length - 1 ? 0 : prev + 1))
  }

  return (
    <div className={cn("space-y-space-md", className)}>
      {/* Main Hero Card */}
      <div className="relative w-full rounded-2xl bg-gradient-to-r from-[#EBF2FA] via-[#F4F7FB] to-[#FAF7F2] p-space-lg sm:p-space-xl overflow-hidden min-h-[380px] flex flex-col justify-between border border-surface-container/70 shadow-sm">
        {/* Decorative subtle background circle */}
        <div className="absolute right-0 top-0 w-96 h-96 rounded-full bg-primary-fixed/20 blur-3xl pointer-events-none" />

        {/* Text Content */}
        <div className="relative z-10 max-w-xl space-y-space-xs">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-on-primary font-label-sm text-label-sm font-semibold shadow-xs">
            <span>{slide.tag}</span>
          </div>

          <h1 className="font-display-sm sm:font-display-lg text-display-sm sm:text-display-lg text-primary font-bold tracking-tight pt-1">
            {slide.title}
          </h1>

          <p className="font-headline-sm text-headline-sm text-secondary-container font-semibold">
            {slide.subtitle}
          </p>

          <p className="font-body-md text-body-md text-on-surface-variant max-w-md pt-1">
            {slide.description}
          </p>

          {/* Action CTAs */}
          <div className="flex flex-wrap items-center gap-space-sm sm:gap-space-md pt-space-md">
            <button
              type="button"
              onClick={() => onPrimaryClick?.(slide.id)}
              className="inline-flex items-center gap-space-xs px-space-lg py-2.5 rounded-lg bg-secondary-container hover:bg-secondary text-on-secondary font-label-md text-label-md font-bold transition-all shadow-sm cursor-pointer"
            >
              <span>{slide.ctaPrimaryText}</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            {slide.ctaSecondaryText && (
              <button
                type="button"
                onClick={() => onSecondaryClick?.(slide.id)}
                className="inline-flex items-center gap-space-xs px-space-lg py-2.5 rounded-lg bg-surface-container-lowest hover:bg-primary hover:text-on-primary text-primary font-label-md text-label-md font-bold transition-all border border-surface-container shadow-xs cursor-pointer"
              >
                <span>{slide.ctaSecondaryText}</span>
              </button>
            )}
          </div>
        </div>

        {/* Product Image Placement */}
        <div className="absolute right-4 bottom-4 w-48 sm:w-72 lg:w-88 h-48 sm:h-72 lg:h-88 hidden sm:flex items-center justify-center pointer-events-none">
          <img
            src={slide.imageUrl}
            alt={slide.title}
            className="w-full h-full object-contain filter drop-shadow-xl"
          />
        </div>

        {/* Carousel Controls */}
        <div className="relative z-10 flex items-center justify-between pt-space-lg">
          {/* Indicators */}
          <div className="flex items-center gap-1.5">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlideIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                className={cn(
                  "h-2 rounded-full transition-all cursor-pointer",
                  idx === currentSlideIndex
                    ? "w-8 bg-primary"
                    : "w-2 bg-outline-variant hover:bg-outline"
                )}
              />
            ))}
          </div>

          {/* Navigation Arrows */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous slide"
              className="h-8 w-8 rounded-full bg-surface-container-lowest hover:bg-surface-container text-on-surface shadow-xs flex items-center justify-center cursor-pointer transition-colors border border-surface-container"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next slide"
              className="h-8 w-8 rounded-full bg-surface-container-lowest hover:bg-surface-container text-on-surface shadow-xs flex items-center justify-center cursor-pointer transition-colors border border-surface-container"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Proposition Bar with Neutral, Non-Guarantee Messaging */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-space-sm sm:gap-gutter">
        <div className="flex items-center gap-space-sm p-space-md rounded-xl bg-surface-container-lowest border border-surface-container/60 shadow-xs">
          <Truck className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <h4 className="font-label-md text-label-md font-bold text-on-surface truncate">
              Order Delivery
            </h4>
            <p className="font-body-sm text-body-sm text-outline truncate">
              Standard shipping
            </p>
          </div>
        </div>

        <div className="flex items-center gap-space-sm p-space-md rounded-xl bg-surface-container-lowest border border-surface-container/60 shadow-xs">
          <RotateCcw className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <h4 className="font-label-md text-label-md font-bold text-on-surface truncate">
              Return Policy
            </h4>
            <p className="font-body-sm text-body-sm text-outline truncate">
              Eligible product returns
            </p>
          </div>
        </div>

        <div className="flex items-center gap-space-sm p-space-md rounded-xl bg-surface-container-lowest border border-surface-container/60 shadow-xs">
          <ShieldCheck className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <h4 className="font-label-md text-label-md font-bold text-on-surface truncate">
              Direct Brands
            </h4>
            <p className="font-body-sm text-body-sm text-outline truncate">
              Catalog products
            </p>
          </div>
        </div>

        <div className="flex items-center gap-space-sm p-space-md rounded-xl bg-surface-container-lowest border border-surface-container/60 shadow-xs">
          <Award className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="min-w-0">
            <h4 className="font-label-md text-label-md font-bold text-on-surface truncate">
              Store Partners
            </h4>
            <p className="font-body-sm text-body-sm text-outline truncate">
              Registered sellers
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
