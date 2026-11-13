/**
 * Frontend Presentation Models
 * Used by UI components and mock datasets.
 */

export interface UiProductImage {
  id: string
  imageUrl: string
  isPrimary: boolean
  displayOrder: number
}

export interface UiProductCardModel {
  id: string
  name: string
  brand?: string
  sku: string
  price: number // Clean numeric value for UI formatting via Intl.NumberFormat
  imageUrl: string
  categoryName?: string
  isActive: boolean
}

export interface UiProductDetailModel extends UiProductCardModel {
  description?: string
  categoryId?: string
  images: UiProductImage[]
}

export interface UiCategoryModel {
  id: string
  name: string
  description?: string
  iconName?: string
  imageUrl?: string
}

export interface UiPaginatedList<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasMore: boolean
}
