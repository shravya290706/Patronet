import { createContext, useContext, useState, type ReactNode } from "react"
import type { UiProductCardModel } from "@/types/ui.types"

export type AssistantType = "compare" | "shopping-buddy" | "negotiator" | null

interface SmartShoppingContextValue {
  // Compare Buddy
  comparisonList: UiProductCardModel[]
  addToCompare: (product: UiProductCardModel) => boolean
  removeFromCompare: (productId: string) => void
  clearCompare: () => void
  isCompared: (productId: string) => boolean
  compareNotice: string | null

  // Assistant Modals / Drawers
  activeAssistant: AssistantType
  openAssistant: (type: "compare" | "shopping-buddy" | "negotiator") => void
  closeAssistant: () => void

  // Negotiator Target Product Context (if negotiating single item)
  negotiateProduct: UiProductCardModel | null
  startNegotiationForProduct: (product: UiProductCardModel) => void

  // Global Actions pass-through
  onNavigateProduct?: (id: string) => void
  onAddToCart?: (id: string, quantity?: number) => Promise<void>
  cartSubtotal: number
  cartItemCount: number
}

const SmartShoppingContext = createContext<SmartShoppingContextValue | undefined>(undefined)

interface SmartShoppingProviderProps {
  children: ReactNode
  onNavigateProduct?: (id: string) => void
  onAddToCart?: (id: string, quantity?: number) => Promise<void>
  cartSubtotal?: number
  cartItemCount?: number
}

const MAX_COMPARE_ITEMS = 4

export function SmartShoppingProvider({
  children,
  onNavigateProduct,
  onAddToCart,
  cartSubtotal = 0,
  cartItemCount = 0,
}: SmartShoppingProviderProps) {
  const [comparisonList, setComparisonList] = useState<UiProductCardModel[]>([])
  const [compareNotice, setCompareNotice] = useState<string | null>(null)
  const [activeAssistant, setActiveAssistant] = useState<AssistantType>(null)
  const [negotiateProduct, setNegotiateProduct] = useState<UiProductCardModel | null>(null)

  const showTemporaryNotice = (msg: string) => {
    setCompareNotice(msg)
    window.setTimeout(() => {
      setCompareNotice((curr) => (curr === msg ? null : curr))
    }, 3500)
  }

  const addToCompare = (product: UiProductCardModel): boolean => {
    if (comparisonList.some((item) => item.id === product.id)) {
      removeFromCompare(product.id)
      showTemporaryNotice(`Removed "${product.name.slice(0, 24)}…" from Compare Buddy.`)
      return false
    }

    if (comparisonList.length >= MAX_COMPARE_ITEMS) {
      showTemporaryNotice(`Maximum ${MAX_COMPARE_ITEMS} products can be compared at once. Please remove an item first.`)
      setActiveAssistant("compare")
      return false
    }

    setComparisonList((prev) => [...prev, product])
    showTemporaryNotice(`Added "${product.name.slice(0, 24)}…" to Compare Buddy (${comparisonList.length + 1}/${MAX_COMPARE_ITEMS}).`)
    return true
  }

  const removeFromCompare = (productId: string) => {
    setComparisonList((prev) => prev.filter((item) => item.id !== productId))
  }

  const clearCompare = () => {
    setComparisonList([])
    showTemporaryNotice("Comparison list cleared.")
  }

  const isCompared = (productId: string) => {
    return comparisonList.some((item) => item.id === productId)
  }

  const openAssistant = (type: "compare" | "shopping-buddy" | "negotiator") => {
    setActiveAssistant(type)
  }

  const closeAssistant = () => {
    setActiveAssistant(null)
  }

  const startNegotiationForProduct = (product: UiProductCardModel) => {
    setNegotiateProduct(product)
    setActiveAssistant("negotiator")
  }

  return (
    <SmartShoppingContext.Provider
      value={{
        comparisonList,
        addToCompare,
        removeFromCompare,
        clearCompare,
        isCompared,
        compareNotice,
        activeAssistant,
        openAssistant,
        closeAssistant,
        negotiateProduct,
        startNegotiationForProduct,
        onNavigateProduct,
        onAddToCart,
        cartSubtotal,
        cartItemCount,
      }}
    >
      {children}
    </SmartShoppingContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSmartShopping() {
  const context = useContext(SmartShoppingContext)
  if (!context) {
    return {
      comparisonList: [],
      addToCompare: () => false,
      removeFromCompare: () => {},
      clearCompare: () => {},
      isCompared: () => false,
      compareNotice: null,
      activeAssistant: null,
      openAssistant: () => {},
      closeAssistant: () => {},
      negotiateProduct: null,
      startNegotiationForProduct: () => {},
      cartSubtotal: 0,
      cartItemCount: 0,
    }
  }
  return context
}
