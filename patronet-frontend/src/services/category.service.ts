/**
 * Category API Service
 */

import { apiClient } from "./api.client"
import type { ApiCategory } from "@/types/api.types"
import type { UiCategoryModel } from "@/types/ui.types"
import { mapApiCategory } from "./mappers/product.mapper"

/**
 * Fetches all categories from GET /api/categories.
 */
export async function getCategories(): Promise<ApiCategory[]> {
  return apiClient<ApiCategory[]>("/api/categories")
}

/**
 * Fetches categories and maps them directly to UI presentation models.
 */
export async function getUiCategories(): Promise<UiCategoryModel[]> {
  const categories = await getCategories()
  return categories.map(mapApiCategory)
}
