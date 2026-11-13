import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  if (totalPages <= 1) return null

  // Generate page numbers with ellipsis
  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = []
    const delta = 1

    for (let i = 1; i <= totalPages; i++) {
      if (
        i === 1 ||
        i === totalPages ||
        (i >= currentPage - delta && i <= currentPage + delta)
      ) {
        pages.push(i)
      } else if (pages[pages.length - 1] !== "ellipsis") {
        pages.push("ellipsis")
      }
    }
    return pages
  }

  const pageNumbers = getPageNumbers()

  return (
    <nav
      aria-label="Pagination Navigation"
      className={cn("flex items-center justify-center gap-1.5 py-space-md", className)}
    >
      {/* Previous button */}
      <button
        type="button"
        disabled={currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-variant text-on-surface disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-label-md text-label-md transition-colors cursor-pointer"
        aria-label="Previous Page"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Previous</span>
      </button>

      {/* Numerical buttons */}
      {pageNumbers.map((page, index) => {
        if (page === "ellipsis") {
          return (
            <span
              key={`ellipsis-${index}`}
              className="px-2 text-outline font-label-md select-none"
            >
              ...
            </span>
          )
        }

        const isCurrent = page === currentPage

        return (
          <button
            key={`page-${page}`}
            type="button"
            onClick={() => onPageChange(page)}
            aria-current={isCurrent ? "page" : undefined}
            className={cn(
              "w-9 h-9 rounded-lg font-label-md text-label-md transition-colors cursor-pointer flex items-center justify-center",
              isCurrent
                ? "bg-primary text-on-primary font-bold shadow-xs"
                : "bg-surface-container-low hover:bg-surface-variant text-on-surface"
            )}
          >
            {page}
          </button>
        )
      })}

      {/* Next button */}
      <button
        type="button"
        disabled={currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-variant text-on-surface disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 font-label-md text-label-md transition-colors cursor-pointer"
        aria-label="Next Page"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    </nav>
  )
}
