/**
 * API-to-UI Mapping Adapters
 * Safely transforms raw backend responses into frontend presentation models.
 */

import type {
  ApiProduct,
  ApiProductDetail,
  ApiCategory,
  ApiProductImage,
  ApiPaginatedProducts,
} from "@/types/api.types"
import type {
  UiProductCardModel,
  UiProductDetailModel,
  UiCategoryModel,
  UiProductImage,
  UiPaginatedList,
} from "@/types/ui.types"

// Default placeholder image when backend image is missing or null
export const FALLBACK_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=500&q=80"

/**
 * Parses decimal string or number from backend into a validated floating point number.
 * Explicitly validates data:
 * - Empty strings, null, undefined, or non-numeric strings throw an explicit Error.
 * - Negative prices throw an explicit Error.
 * - Zero is treated as valid (0).
 */
export function parseApiPrice(priceInput: unknown): number {
  if (priceInput === null || priceInput === undefined) {
    throw new Error(`[parseApiPrice] Missing price value: received ${priceInput}`)
  }

  let numValue: number

  if (typeof priceInput === "number") {
    numValue = priceInput
  } else if (typeof priceInput === "string") {
    const trimmed = priceInput.trim()
    if (trimmed === "") {
      throw new Error("[parseApiPrice] Empty string received for price")
    }
    numValue = Number(trimmed)
  } else {
    throw new Error(`[parseApiPrice] Invalid price type: received ${typeof priceInput}`)
  }

  if (isNaN(numValue)) {
    throw new Error(`[parseApiPrice] Non-numeric price string: received "${priceInput}"`)
  }

  if (numValue < 0) {
    throw new Error(`[parseApiPrice] Negative price detected: ${numValue}`)
  }

  return numValue
}

/**
 * Maps an ApiProductImage to a UiProductImage.
 */
export function mapApiProductImage(img: ApiProductImage): UiProductImage {
  return {
    id: img.id,
    imageUrl: img.image_url || FALLBACK_PRODUCT_IMAGE,
    isPrimary: img.is_primary,
    displayOrder: img.display_order,
  }
}

/**
 * Maps a single ApiProduct to a UiProductCardModel.
 */
export function mapApiProductToCard(apiProd: ApiProduct): UiProductCardModel {
  return {
    id: apiProd.id,
    name: apiProd.name,
    brand: apiProd.brand || undefined,
    sku: apiProd.sku,
    price: parseApiPrice(apiProd.price),
    imageUrl: apiProd.primary_image?.image_url || FALLBACK_PRODUCT_IMAGE,
    categoryName: apiProd.category?.name || undefined,
    isActive: apiProd.is_active,
  }
}

/**
 * Maps full ApiProductDetail to UiProductDetailModel.
 */
export function mapApiProductDetail(apiDetail: ApiProductDetail): UiProductDetailModel {
  const images = (apiDetail.images || []).map(mapApiProductImage)
  const primaryImg =
    images.find((i) => i.isPrimary)?.imageUrl ||
    apiDetail.primary_image?.image_url ||
    images[0]?.imageUrl ||
    FALLBACK_PRODUCT_IMAGE

  return {
    id: apiDetail.id,
    name: apiDetail.name,
    brand: apiDetail.brand || undefined,
    sku: apiDetail.sku,
    price: parseApiPrice(apiDetail.price),
    imageUrl: primaryImg,
    categoryName: apiDetail.category?.name || undefined,
    categoryId: apiDetail.category?.id || undefined,
    isActive: apiDetail.is_active,
    description: apiDetail.description || undefined,
    images: images.length > 0 ? images : [
      {
        id: "default-image",
        imageUrl: primaryImg,
        isPrimary: true,
        displayOrder: 0,
      },
    ],
  }
}

/**
 * Maps an ApiCategory to a UiCategoryModel.
 */
export function mapApiCategory(apiCat: ApiCategory): UiCategoryModel {
  return {
    id: apiCat.id,
    name: apiCat.name,
    description: apiCat.description || undefined,
  }
}

/**
 * Maps paginated API product response to UI paginated list.
 */
export function mapApiPaginatedProducts(
  paginated: ApiPaginatedProducts
): UiPaginatedList<UiProductCardModel> {
  const totalPages = Math.ceil(paginated.total / (paginated.page_size || 1))
  return {
    items: (paginated.results || []).map(mapApiProductToCard),
    total: paginated.total,
    page: paginated.page,
    pageSize: paginated.page_size,
    totalPages,
    hasMore: paginated.page < totalPages,
  }
}
