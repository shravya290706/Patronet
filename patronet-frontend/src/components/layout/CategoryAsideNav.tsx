import { ChevronRight, Sparkles } from "lucide-react"
import type { MockCategory } from "@/mocks/categories.mock"
import { cn } from "@/lib/utils"

interface CategoryAsideNavProps {
  categories: MockCategory[]
  selectedCategoryId?: string
  onCategorySelect?: (id: string) => void
  className?: string
}

export function CategoryAsideNav({
  categories,
  selectedCategoryId,
  onCategorySelect,
  className,
}: CategoryAsideNavProps) {
  return (
    <aside className={cn("w-full flex flex-col gap-space-md", className)}>
      {/* Category Navigator Card */}
      <div className="w-full bg-surface-container-lowest rounded-xl p-space-md shadow-sm border border-surface-container/60">
        <div className="flex items-center justify-between pb-space-sm mb-space-sm border-b border-surface-container">
          <div className="flex items-center gap-space-xs">
            <h2 className="font-title-md text-title-md text-primary font-bold">
              Categories
            </h2>
          </div>
          <span className="bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm px-2 py-0.5 rounded-full font-bold">
            Catalog
          </span>
        </div>

        {/* Vertical Category Navigation List */}
        <nav aria-label="Department Catalog" className="flex flex-col gap-0.5">
          {categories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id
            return (
              <a
                key={cat.id}
                href={`#category-${cat.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  onCategorySelect?.(cat.id)
                }}
                className={cn(
                  "group flex items-center justify-between px-space-sm py-2 rounded-lg transition-all cursor-pointer",
                  isSelected
                    ? "text-primary bg-primary-fixed/40 font-semibold"
                    : "text-on-surface-variant hover:text-primary hover:bg-surface-container"
                )}
              >
                <div className="flex items-center gap-space-sm min-w-0">
                  <span className="font-label-md text-label-md truncate">
                    {cat.name}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 text-outline group-hover:text-primary flex-shrink-0" />
              </a>
            )
          })}
        </nav>
      </div>

      {/* PATRONET Plus Membership Card (Neutral Non-Guarantee Copy) */}
      <div className="w-full bg-gradient-to-br from-primary via-primary-container to-tertiary text-on-primary rounded-xl p-space-md shadow-sm relative overflow-hidden">
        <div className="flex items-center gap-space-xs mb-space-xs">
          <span className="bg-secondary-container text-on-secondary text-label-sm font-label-sm px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
            Plus
          </span>
          <span className="font-label-md text-label-md font-bold text-primary-fixed">
            Membership
          </span>
        </div>
        <h3 className="font-title-md text-title-md font-bold">
          Marketplace Benefits &amp; Account Features
        </h3>
        <p className="font-body-sm text-body-sm text-on-primary-container mt-1">
          Learn about membership account privileges and customer features.
        </p>
        <button
          type="button"
          onClick={() => onCategorySelect?.("membership-info")}
          className="mt-space-md w-full py-2 rounded-lg bg-surface-container-lowest text-primary hover:bg-primary-fixed font-label-md text-label-md font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
        >
          <Sparkles className="h-4 w-4 text-secondary-container" />
          <span>View Details</span>
        </button>
      </div>
    </aside>
  )
}
