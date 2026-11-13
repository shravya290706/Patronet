from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ProductImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    image_url: str
    is_primary: bool
    display_order: int


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None


class ProductSummary(BaseModel):
    """Lightweight product representation used in paginated listing."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    brand: str | None = None
    sku: str
    price: Decimal
    is_active: bool
    category: CategoryOut
    primary_image: ProductImageOut | None = None
    created_at: datetime


class ProductDetail(BaseModel):
    """Full product representation including all images."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    brand: str | None = None
    sku: str
    price: Decimal
    is_active: bool
    category: CategoryOut
    images: list[ProductImageOut] = []
    created_at: datetime
    updated_at: datetime | None = None


class PaginatedProducts(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[ProductSummary]


class StoreAvailabilityOut(BaseModel):
    id: UUID
    name: str
    city: str
    state: str
    pincode: str
    address: str
    is_active: bool
    available_stock: int


class ProductSearchResult(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    brand: str | None = None
    sku: str
    price: Decimal
    is_active: bool
    category: CategoryOut
    primary_image: ProductImageOut | None = None
    created_at: datetime
    stores: list[StoreAvailabilityOut] = Field(default_factory=list)


class ProductSearchResponse(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[ProductSearchResult]
