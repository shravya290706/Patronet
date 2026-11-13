import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SectionHeadingProps {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
  level?: 1 | 2 | 3 | 4
}

export function SectionHeading({
  title,
  subtitle,
  action,
  className,
  level = 2,
}: SectionHeadingProps) {
  const HeadingTag = `h${level}` as const

  return (
    <div className={cn("flex items-center justify-between gap-space-md mb-space-md", className)}>
      <div>
        <HeadingTag className="font-headline-lg text-headline-lg text-on-surface font-bold tracking-tight">
          {title}
        </HeadingTag>
        {subtitle && (
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}
