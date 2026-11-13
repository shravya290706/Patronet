from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    UUID,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, uuid_pk


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (CheckConstraint("price >= 0", name="ck_products_price_non_negative"),)

    id: Mapped[object] = uuid_pk()
    category_id: Mapped[object] = mapped_column(
        UUID(as_uuid=True), ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    specifications: Mapped[dict[str, Any]] = mapped_column(
        JSON().with_variant(JSONB(), "postgresql"),
        nullable=False,
        default=dict,
        server_default=text("'{}'"),
    )
    brand: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    sku: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    price: Mapped[object] = mapped_column(Numeric(12, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    category: Mapped["Category"] = relationship("Category", back_populates="products")
    images: Mapped[list["ProductImage"]] = relationship("ProductImage", back_populates="product")
    inventory: Mapped[list["Inventory"]] = relationship("Inventory", back_populates="product")
    cart_items: Mapped[list["CartItem"]] = relationship("CartItem", back_populates="product")
    order_items: Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="product")
