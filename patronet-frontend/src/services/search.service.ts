/**
 * Search Service
 * Connects to GET /api/products/search (OpenSearch-backed).
 * Autocomplete suggestions combine OpenSearch product results with catalogue categories.
 */

import { apiClient } from "./api.client"
import { normalizeApiError } from "./api.errors"
import { getUiCategories } from "./category.service"
import type { ApiSearchResponse, ApiSearchSortOption } from "@/types/api.types"
import type { UiPaginatedList, UiProductCardModel } from "@/types/ui.types"
import { mapApiProductToCard } from "./mappers/product.mapper"
import type { SearchSuggestionItem } from "@/mocks/search.mock"

export interface SearchQueryParams {
  query: string
  page?: number
  pageSize?: number
  categoryId?: string
  brand?: string
  minPrice?: number
  maxPrice?: number
  city?: string
  sort?: ApiSearchSortOption
}

/**
 * Searches products via GET /api/products/search (OpenSearch).
 * Returns an empty page only for an empty query; API failures are surfaced to the caller.
 */
export async function searchProducts(
  params: SearchQueryParams
): Promise<UiPaginatedList<UiProductCardModel>> {
  const { query, page = 1, pageSize = 12 } = params
  const trimmed = query.trim()

  if (!trimmed) {
    return { items: [], total: 0, page: 1, pageSize, totalPages: 1, hasMore: false }
  }

  const cleanParams: Record<string, string | number | undefined> = {
    q: trimmed,
    page,
    page_size: pageSize,
    category_id: params.categoryId,
    brand: params.brand,
    min_price: params.minPrice,
    max_price: params.maxPrice,
    city: params.city,
    sort: params.sort ?? "relevance",
  }

  try {
    const data = await apiClient<ApiSearchResponse>("/api/products/search", {
      params: cleanParams,
    })

    const totalPages = Math.max(1, Math.ceil(data.total / pageSize))
    return {
      items: (data.results ?? []).map(mapApiProductToCard),
      total: data.total,
      page: data.page,
      pageSize: data.page_size,
      totalPages,
      hasMore: data.page < totalPages,
    }
  } catch (rawError) {
    const err = normalizeApiError(rawError)
    // 503 means OpenSearch index not initialized — surface as empty with message
    if (err.status === 503) {
      throw new Error(
        "Product search index is not yet initialized. Run the index rebuild script and try again."
      )
    }
    throw err
  }
}

/**
 * Retrieves product suggestions from OpenSearch and matching category/brand suggestions.
 */
export async function getSearchSuggestions(
  query: string
): Promise<SearchSuggestionItem[]> {
  const trimmed = query.trim()
  if (!trimmed) return []

  const [products, categories] = await Promise.all([
    searchProducts({ query: trimmed, page: 1, pageSize: 5 }),
    getUiCategories(),
  ])
  const productSuggestions: SearchSuggestionItem[] = products.items.map(
    (product) => ({
      id: `product:${product.id}`,
      targetId: product.id,
      title: product.name,
      type: "product",
      subtitle: product.categoryName,
      price: product.price,
      sku: product.sku,
      imageUrl: product.imageUrl,
    })
  )
  const matchingCategories: SearchSuggestionItem[] = categories
    .filter((category) =>
      category.name.toLocaleLowerCase().includes(trimmed.toLocaleLowerCase())
    )
    .slice(0, 3)
    .map((category) => ({
      id: `category:${category.id}`,
      targetId: category.id,
      title: category.name,
      type: "category",
      subtitle: category.description,
    }))
  const matchingBrands: SearchSuggestionItem[] = Array.from(
    new Set(products.items.map((product) => product.brand).filter(Boolean))
  )
    .slice(0, 3)
    .map((brand) => ({
      id: `brand:${brand}`,
      title: brand ?? "",
      type: "brand",
    }))

  return [
    ...productSuggestions,
    ...matchingCategories,
    ...matchingBrands,
  ].slice(0, 10)
}
