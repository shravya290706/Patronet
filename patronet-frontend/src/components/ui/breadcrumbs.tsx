import { ChevronRight, Home } from "lucide-react"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: (e: React.MouseEvent) => void
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
  showHomeIcon?: boolean
}

export function Breadcrumbs({
  items,
  className,
  showHomeIcon = true,
}: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center flex-wrap gap-space-xs font-body-sm text-body-sm text-on-surface-variant",
        className
      )}
    >
      <a
        href="#"
        className="inline-flex items-center gap-1 hover:text-primary transition-colors"
      >
        {showHomeIcon && <Home className="h-3.5 w-3.5" />}
        <span>Home</span>
      </a>

      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <div key={`${item.label}-${index}`} className="inline-flex items-center gap-space-xs">
            <ChevronRight className="h-3.5 w-3.5 text-outline-variant flex-shrink-0" />
            {isLast || (!item.href && !item.onClick) ? (
              <span className="font-semibold text-primary truncate max-w-[200px] sm:max-w-none">
                {item.label}
              </span>
            ) : item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className="hover:text-primary transition-colors truncate max-w-[150px] sm:max-w-none cursor-pointer"
              >
                {item.label}
              </button>
            ) : (
              <a
                href={item.href}
                className="hover:text-primary transition-colors truncate max-w-[150px] sm:max-w-none"
              >
                {item.label}
              </a>
            )}
          </div>
        )
      })}
    </nav>
  )
}
