/**
4:  * Search Mock Data
5:  * Isolated mock suggestions and search results for Phase 7.
6:  */

import type { UiProductCardModel } from "@/types/ui.types"
import { mockCatalogProducts } from "./products.mock"

export interface SearchSuggestionItem {
  id: string
  title: string
  type: "product" | "category" | "brand"
  subtitle?: string
  price?: number
  sku?: string
  imageUrl?: string
  targetId?: string
}

export const mockSearchSuggestions: SearchSuggestionItem[] = [
  {
    id: "sug-1",
    title: "Aura Pro Wireless ANC Studio Headphones",
    type: "product",
    subtitle: "Audio & Sound",
    price: 19999,
    sku: "PAT-ELEC-4912",
    imageUrl: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=200&q=80",
    targetId: "prod-1",
  },
  {
    id: "sug-2",
    title: "PureBass 360 Studio ANC Headphones",
    type: "product",
    subtitle: "Audio & Sound",
    price: 8999,
    sku: "PAT-ELEC-3391",
    imageUrl: "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=200&q=80",
    targetId: "prod-4",
  },
  {
    id: "sug-3",
    title: "AirBuds Pro True Wireless Earbuds",
    type: "product",
    subtitle: "Audio & Sound",
    price: 4999,
    sku: "PAT-ELEC-5519",
    imageUrl: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=200&q=80",
    targetId: "prod-8",
  },
  {
    id: "sug-cat-1",
    title: "Audio & Sound",
    type: "category",
    subtitle: "Electronics > Audio",
    targetId: "cat-audio",
  },
  {
    id: "sug-cat-2",
    title: "Wearables",
    type: "category",
    subtitle: "Electronics > Wearables",
    targetId: "cat-wearables",
  },
  {
    id: "sug-brand-1",
    title: "SonicWave",
    type: "brand",
    subtitle: "Brand in Audio & Sound",
  },
  {
    id: "sug-brand-2",
    title: "Chronos Tech",
    type: "brand",
    subtitle: "Brand in Wearables",
  },
  {
    id: "sug-brand-3",
    title: "Matrix Pro",
    type: "brand",
    subtitle: "Brand in Computing",
  },
]

/**
 * Filter isolated search suggestions based on input query
 */
export function queryMockSuggestions(query: string): SearchSuggestionItem[] {
  const clean = query.trim().toLowerCase()
  if (!clean) return []

  return mockSearchSuggestions.filter(
    (item) =>
      item.title.toLowerCase().includes(clean) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(clean)) ||
      (item.sku && item.sku.toLowerCase().includes(clean))
  )
}

/**
 * Query isolated mock products for search results
 */
export function queryMockSearchResults(query: string): UiProductCardModel[] {
  const clean = query.trim().toLowerCase()
  if (!clean) return []

  return mockCatalogProducts.filter(
    (p) =>
      p.name.toLowerCase().includes(clean) ||
      (p.brand && p.brand.toLowerCase().includes(clean)) ||
      (p.categoryName && p.categoryName.toLowerCase().includes(clean)) ||
      p.sku.toLowerCase().includes(clean)
  )
}
