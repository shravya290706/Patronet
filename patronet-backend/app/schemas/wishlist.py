from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.schemas.product import ProductDetail


class WishlistItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    product: ProductDetail
    added_at: datetime


class WishlistResponse(BaseModel):
    items: list[WishlistItemResponse]
    total: int
