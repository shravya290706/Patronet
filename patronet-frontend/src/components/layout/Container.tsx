import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface ContainerProps {
  children: ReactNode
  className?: string
  as?: "div" | "main" | "section" | "article" | "header" | "footer"
}

export function Container({
  children,
  className,
  as: Component = "div",
}: ContainerProps) {
  return (
    <Component className={cn("w-full max-w-7xl mx-auto px-gutter", className)}>
      {children}
    </Component>
  )
}
