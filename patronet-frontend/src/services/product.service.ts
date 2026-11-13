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
  const cleanId = encodeURIComponent(productId.trim())
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
