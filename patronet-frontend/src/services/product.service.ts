/**
 * Product API Service
 * Exclusively supports approved query parameters and endpoints.
 */

import { apiClient } from "./api.client"
import type {
  ApiProductQueryParams,
  ApiPaginatedProducts,
  ApiProductDetail,
} from "@/types/api.types"
import type {
  UiPaginatedList,
  UiProductCardModel,
  UiProductDetailModel,
} from "@/types/ui.types"
import {
  mapApiPaginatedProducts,
  mapApiProductDetail,
} from "./mappers/product.mapper"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isBackendUuid(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value)
}

export async function getProductBrands(): Promise<string[]> {
  return apiClient<string[]>("/api/products/brands")
}

/**
 * Fetches paginated products from GET /api/products
 * Supported query params only: page, page_size, category_id, brand, min_price, max_price, sort.
 */
export async function getProducts(
  params: ApiProductQueryParams = {}
): Promise<ApiPaginatedProducts> {
  // Construct clean params object omitting unsupported or undefined properties
  const cleanParams: Record<string, string | number | undefined> = {
    page: params.page,
    page_size: params.page_size,
    category_id: params.category_id,
    brand: params.brand,
    min_price: params.min_price,
    max_price: params.max_price,
    sort: params.sort,
  }

  return apiClient<ApiPaginatedProducts>("/api/products", {
    params: cleanParams,
  })
}

/**
 * Fetches paginated products and maps them to UI card presentation models.
 */
export async function getUiProducts(
  params: ApiProductQueryParams = {}
): Promise<UiPaginatedList<UiProductCardModel>> {
  const data = await getProducts(params)
  return mapApiPaginatedProducts(data)
}

/**
 * Fetches product details by UUID from GET /api/products/{product_id}.
 */
export async function getProductDetail(
  productId: string
): Promise<ApiProductDetail> {
  const trimmedId = productId.trim()
  if (!isBackendUuid(trimmedId)) {
    throw new Error("This catalog item does not have a valid product ID.")
  }
  const cleanId = encodeURIComponent(trimmedId)
  return apiClient<ApiProductDetail>(`/api/products/${cleanId}`)
}

/**
 * Fetches product details and maps them to UI detail presentation model.
 */
export async function getUiProductDetail(
  productId: string
): Promise<UiProductDetailModel> {
  const data = await getProductDetail(productId)
  return mapApiProductDetail(data)
}
