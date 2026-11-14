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

/** Sort options for GET /api/products/search (includes relevance) */
export type ApiSearchSortOption = "relevance" | "price_asc" | "price_desc" | "newest"

export interface ApiProductQueryParams {
  page?: number
  page_size?: number
  category_id?: string // UUID
  brand?: string
  min_price?: number
  max_price?: number
  sort?: ApiProductSortOption
}

/** Query parameters for GET /api/products/search */
export interface ApiSearchQueryParams {
  q?: string
  page?: number
  page_size?: number
  category_id?: string
  brand?: string
  min_price?: number
  max_price?: number
  city?: string
  sort?: ApiSearchSortOption
}

/** Store availability nested in search results */
export interface ApiStoreAvailability {
  id: string
  name: string
  city: string
  state: string
  pincode: string
  address: string
  is_active: boolean
  available_stock: number
}

/** Single result from GET /api/products/search */
export interface ApiSearchResult extends ApiProduct {
  stores: ApiStoreAvailability[]
}

/** Response from GET /api/products/search */
export interface ApiSearchResponse {
  total: number
  page: number
  page_size: number
  results: ApiSearchResult[]
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/** POST /api/auth/register request body */
export interface ApiRegisterRequest {
  name: string
  email: string
  password: string
  phone?: string | null
}

/** POST /api/auth/login request body */
export interface ApiLoginRequest {
  email: string
  password: string
}

/** POST /api/auth/login response */
export interface ApiAccessTokenResponse {
  access_token: string
  token_type: "bearer"
  expires_in: number
}

/** GET /api/auth/me response */
export interface ApiCustomerProfile {
  id: string
  name: string
  email: string
  phone: string | null
  created_at: string
}

// ── Cart ──────────────────────────────────────────────────────────────────────

/** POST /api/cart/items request body */
export interface ApiCartItemCreate {
  product_id: string
  quantity: number
}

/** PATCH /api/cart/items/{item_id} request body */
export interface ApiCartItemUpdate {
  quantity: number
}

export interface ApiCartItem {
  id: string
  product: ApiProductDetail
  quantity: number
  unit_price: string
  subtotal: string
}

export interface ApiCartResponse {
  id: string | null
  items: ApiCartItem[]
  total_quantity: number
  subtotal: string
}

// ── Wishlist ──────────────────────────────────────────────────────────────────

export interface ApiWishlistItem {
  id: string
  product: ApiProductDetail
  added_at: string
}

export interface ApiWishlistResponse {
  items: ApiWishlistItem[]
  total: number
}

// ── Addresses ─────────────────────────────────────────────────────────────────

export interface ApiAddress {
  id: string
  full_name: string
  phone: string
  address_line_1: string
  address_line_2: string | null
  city: string
  state: string
  pincode: string
  country: string | null
  label: string | null
  is_default: boolean
  created_at: string
}

export interface ApiAddressCreate {
  full_name: string
  phone: string
  address_line_1: string
  address_line_2?: string | null
  city: string
  state: string
  pincode: string
  country: string
  label?: string | null
  is_default: boolean
}

export type ApiAddressUpdate = Partial<ApiAddressCreate>

// ── Orders ────────────────────────────────────────────────────────────────────

/** POST /api/orders/checkout request body */
export interface ApiCheckoutRequest {
  address_id: string
  payment_method?: string | null
  gift_card_code?: string | null
  gift_card_amount?: number | string | null
}

export interface ApiOrderAddressSnapshot {
  full_name: string | null
  phone: string | null
  address_line: string | null
  city: string | null
  state: string | null
  pincode: string | null
}

export interface ApiOrderItem {
  id: string
  product_id: string
  store_id: string
  quantity: number
  unit_price: string
  subtotal: string
}

export interface ApiOrderResponse {
  id: string
  order_number: string
  status: string
  payment_status: string
  payment_method: string | null
  address_id: string
  delivery_address: ApiOrderAddressSnapshot
  items: ApiOrderItem[]
  subtotal: string
  total_amount: string
  razorpay_order_id?: string | null
  razorpay_payment_id?: string | null
  gift_card_code?: string | null
  gift_card_amount?: string | null
  payable_amount?: string | null
  created_at: string
}

export interface ApiPaginatedOrders {
  total: number
  page: number
  page_size: number
  results: ApiOrderResponse[]
}

// ── Payments & Gift Cards ─────────────────────────────────────────────────────

export interface ApiPaymentConfig {
  razorpay_key_id: string
  mode: "test" | "mock"
  is_test_mode: boolean
  currency: string
}

export interface ApiInitiateCheckoutRequest {
  address_id: string
  gift_card_code?: string | null
}

export interface ApiInitiateCheckoutResponse {
  order_id: string
  order_number: string
  subtotal: string
  gift_card_code: string | null
  gift_card_amount: string
  payable_amount: string
  razorpay_order_id: string | null
  currency: string
  key_id: string
  mode: "test" | "mock"
  status: "pending_payment" | "placed"
}

export interface ApiVerifyPaymentRequest {
  order_id: string
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

export interface ApiCancelPaymentRequest {
  order_id: string
  reason?: string | null
}

export interface ApiCancelPaymentResponse {
  order_id: string
  status: string
  payment_status: string
  message: string
}

export interface ApiGiftCardValidateRequest {
  code: string
  cart_subtotal?: number | string | null
}

export interface ApiGiftCardValidateResponse {
  valid: boolean
  code: string
  current_balance: string
  applicable_amount: string
  description?: string | null
  message: string
}

export interface ApiDemoGiftCard {
  code: string
  balance: string
  description: string
}
