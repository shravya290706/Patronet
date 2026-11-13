import { MapPin, X } from "lucide-react"
import { Container } from "./Container"
import { cn } from "@/lib/utils"

interface NavigationProps {
  currentLocation?: string
  mobileMenuOpen: boolean
  onCloseMobileMenu: () => void
  onCategorySelect?: (categoryId: string) => void
  className?: string
}

export function Navigation({
  currentLocation,
  mobileMenuOpen,
  onCloseMobileMenu,
  onCategorySelect,
  className,
}: NavigationProps) {
  // Navigation categories and links present in Stitch design
  const navItems = [
    { id: "all", label: "All Departments" },
    { id: "deals", label: "Today's Deals" },
    { id: "customer-service", label: "Customer Service" },
    { id: "registry", label: "Registry" },
    { id: "gift-cards", label: "Gift Cards" },
    { id: "sell", label: "Sell on Patronet" },
  ]

  const handleItemClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    if (onCategorySelect) {
      onCategorySelect(id)
    }
    onCloseMobileMenu()
  }

  const deliveryLabel = currentLocation ? `Deliver to: ${currentLocation}` : "Select delivery location"

  return (
    <>
      {/* Desktop / Tablet Sub-navigation Bar */}
      <div className={cn("h-10 bg-surface-container-low border-t border-surface-container/60", className)}>
        <Container className="h-full flex items-center justify-between text-body-sm font-body-sm text-on-surface-variant overflow-x-auto no-scrollbar whitespace-nowrap">
          {/* Location Delivery Picker */}
          <div
            className="flex items-center gap-space-xs flex-shrink-0 mr-space-lg select-none cursor-pointer hover:text-primary transition-colors"
            role="button"
            tabIndex={0}
            aria-label="Select delivery location"
          >
            <MapPin className="h-4 w-4 text-primary" />
            <span className="font-label-md text-label-md text-on-surface">
              {deliveryLabel}
            </span>
          </div>

          {/* Navigation Links */}
          <nav aria-label="Department navigation" className="flex items-center gap-space-lg">
            {navItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleItemClick(item.id, e)}
                className="text-on-surface-variant hover:text-primary font-body-sm text-body-sm transition-colors cursor-pointer py-1"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </Container>
      </div>

      {/* Mobile Off-canvas Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[120px] z-40 bg-foreground/20 backdrop-blur-xs md:hidden animate-in fade-in duration-200">
          <div
            className="w-4/5 max-w-sm h-full bg-surface-container-lowest shadow-xl flex flex-col p-gutter animate-in slide-in-from-left duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
          >
            <div className="flex items-center justify-between pb-space-md border-b border-surface-container">
              <span className="font-headline-sm text-headline-sm text-primary font-bold">
                Menu
              </span>
              <button
                type="button"
                onClick={onCloseMobileMenu}
                className="p-1 rounded-lg text-outline hover:text-on-surface"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-space-md border-b border-surface-container flex items-center gap-space-xs text-body-sm select-none">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-label-md text-label-md text-on-surface">
                {deliveryLabel}
              </span>
            </div>

            <nav className="flex flex-col gap-space-sm pt-space-md overflow-y-auto">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={(e) => handleItemClick(item.id, e)}
                  className="py-2 px-space-sm rounded-lg text-body-md font-body-md text-on-surface hover:bg-surface-container-low hover:text-primary transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
