/**
 * Backend API Response Models
 * Strictly mirrors the agreed FastAPI REST backend schemas.
 */

export interface ApiCategory {
  id: string // UUID string
  name: string
  description?: string | null
  created_at?: string
}

export interface ApiProductImage {
  id: string // UUID string
  image_url: string
  is_primary: boolean
  display_order: number
}

export interface ApiProduct {
  id: string // UUID string
  name: string
  brand?: string | null
  sku: string
  price: string // Decimal formatted string in JSON (e.g. "19999.00")
  is_active: boolean
  category?: ApiCategory | null
  primary_image?: ApiProductImage | null
  created_at?: string
}

export interface ApiProductDetail extends ApiProduct {
  description?: string | null
  images: ApiProductImage[]
}

export interface ApiPaginatedProducts {
  total: number
  page: number
  page_size: number
  results: ApiProduct[]
}

/**
 * Supported query parameters for GET /api/products
 * No unsupported query parameters (e.g. `q`, `search`, `rating`) are permitted.
 */
export type ApiProductSortOption = "price_asc" | "price_desc" | "newest"

export interface ApiProductQueryParams {
  page?: number
  page_size?: number
  category_id?: string // UUID
  brand?: string
  min_price?: number
  max_price?: number
  sort?: ApiProductSortOption
}
