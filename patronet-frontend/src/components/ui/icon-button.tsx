import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  ariaLabel: string
  badgeCount?: number
  variant?: "default" | "surface" | "primary" | "secondary"
  size?: "sm" | "md" | "lg"
}

export function IconButton({
  children,
  ariaLabel,
  badgeCount,
  variant = "default",
  size = "md",
  className,
  ...props
}: IconButtonProps) {
  const sizeClasses = {
    sm: "h-8 w-8 text-body-sm",
    md: "h-10 w-10 text-body-md",
    lg: "h-11 w-11 text-title-md",
  }

  const variantClasses = {
    default: "text-on-surface-variant hover:text-primary bg-transparent",
    surface: "bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface",
    primary: "bg-primary text-on-primary hover:bg-primary-container shadow-xs",
    secondary: "bg-secondary-container text-on-secondary hover:bg-secondary shadow-sm",
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full transition-colors flex-shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
      {typeof badgeCount === "number" && badgeCount > 0 && (
        <span className="absolute top-0 right-0 h-4 min-w-[16px] px-1 rounded-full bg-secondary-container text-on-secondary font-label-sm text-label-sm flex items-center justify-center">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </button>
  )
}
