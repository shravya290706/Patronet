from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.product import ProductDetail


class CartItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: UUID
    quantity: int = Field(gt=0)


class CartItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    quantity: int = Field(gt=0)


class CartItemResponse(BaseModel):
    id: UUID
    product: ProductDetail
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class CartResponse(BaseModel):
    id: UUID | None
    items: list[CartItemResponse] = Field(default_factory=list)
    total_quantity: int
    subtotal: Decimal
