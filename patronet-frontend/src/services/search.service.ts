/**
 * Search Service Integration Hook
 * Isolated mock search architecture ready for future OpenSearch API integration.
 */

import type { UiPaginatedList, UiProductCardModel } from "@/types/ui.types"
import {
  type SearchSuggestionItem,
  queryMockSuggestions,
  queryMockSearchResults,
} from "@/mocks/search.mock"

export interface SearchQueryParams {
  query: string
  page?: number
  pageSize?: number
}

/**
 * Searches products using query parameters.
 * When backend OpenSearch endpoint is exposed, this function can connect to apiClient.
 */
export async function searchProducts(
  params: SearchQueryParams
): Promise<UiPaginatedList<UiProductCardModel>> {
  const { query, page = 1, pageSize = 12 } = params
  const trimmed = query.trim()

  if (!trimmed) {
    return {
      items: [],
      total: 0,
      page: 1,
      pageSize,
      totalPages: 1,
      hasMore: false,
    }
  }

  // Use isolated mock search results
  const matching = queryMockSearchResults(trimmed)
  const total = matching.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const start = (page - 1) * pageSize
  const items = matching.slice(start, start + pageSize)

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  }
}

/**
 * Retrieves search suggestions for auto-complete.
 */
export async function getSearchSuggestions(
  query: string
): Promise<SearchSuggestionItem[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  // Simulated instant lookup from mock suggestions
  return queryMockSuggestions(trimmed)
}
