import { ArrowRight } from "lucide-react"
import type { MockCategory } from "@/mocks/categories.mock"
import { cn } from "@/lib/utils"

interface CategoryCardProps {
  category: MockCategory
  onClick?: (id: string) => void
  className?: string
}

export function CategoryCard({
  category,
  onClick,
  className,
}: CategoryCardProps) {
  return (
    <a
      href={`#category-${category.id}`}
      onClick={(e) => {
        e.preventDefault()
        onClick?.(category.id)
      }}
      className={cn(
        "group relative bg-[#F0F4FA] rounded-xl p-space-md overflow-hidden transition-all duration-300 hover:-translate-y-1 shadow-sm flex flex-col justify-between h-52 border border-surface-container/60 cursor-pointer",
        className
      )}
    >
      <div className="flex items-start justify-between relative z-10">
        <div>
          <h3 className="font-title-md text-title-md font-bold text-primary group-hover:text-secondary-container transition-colors">
            {category.name}
          </h3>
          {category.description && (
            <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-1 mt-0.5">
              {category.description}
            </p>
          )}
        </div>
      </div>

      {category.imageUrl && (
        <div className="w-28 h-28 self-end -mr-2 -mb-2">
          <img
            src={category.imageUrl}
            alt={category.name}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        </div>
      )}

      <div className="relative z-10 flex items-center gap-1 font-label-sm text-label-sm text-primary font-bold group-hover:text-secondary-container transition-colors pt-2">
        <span>Explore</span>
        <ArrowRight className="h-3 w-3" />
      </div>
    </a>
  )
}
