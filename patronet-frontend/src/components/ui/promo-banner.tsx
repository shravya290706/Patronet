import { ArrowRight, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface PromoBannerProps {
  title: string
  subtitle: string
  badgeText?: string
  ctaText?: string
  onCtaClick?: () => void
  className?: string
}

export function PromoBanner({
  title,
  subtitle,
  badgeText = "Partner Highlight",
  ctaText = "Learn More",
  onCtaClick,
  className,
}: PromoBannerProps) {
  return (
    <section
      className={cn(
        "w-full rounded-2xl bg-gradient-to-r from-primary via-primary-container to-[#1a2d6b] p-space-md sm:p-space-lg text-on-primary shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-md border border-primary-container",
        className
      )}
    >
      <div className="flex items-center gap-space-md">
        <div className="h-12 w-12 rounded-xl bg-surface-container-lowest/15 backdrop-blur-xs flex items-center justify-center flex-shrink-0">
          <Sparkles className="h-6 w-6 text-secondary-container" />
        </div>
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary font-label-sm text-label-sm font-bold shadow-xs">
            <span>{badgeText}</span>
          </div>
          <h3 className="font-title-md sm:font-headline-sm text-title-md sm:text-headline-sm font-bold mt-1 text-white">
            {title}
          </h3>
          <p className="font-body-sm text-body-sm text-primary-fixed">
            {subtitle}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-space-sm flex-shrink-0 w-full md:w-auto">
        <button
          type="button"
          onClick={onCtaClick}
          className="w-full md:w-auto text-center px-space-lg py-2.5 rounded-lg bg-surface-container-lowest text-primary hover:bg-primary-fixed font-label-md text-label-md font-bold transition-all shadow-sm flex items-center justify-center gap-1 cursor-pointer"
        >
          <span>{ctaText}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}
