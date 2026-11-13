import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ProductGridProps {
  children: ReactNode
  columns?: 2 | 3 | 4
  className?: string
}

export function ProductGrid({
  children,
  columns = 4,
  className,
}: ProductGridProps) {
  const columnClasses = {
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  }

  return (
    <div className={cn("grid gap-gutter", columnClasses[columns], className)}>
      {children}
    </div>
  )
}
