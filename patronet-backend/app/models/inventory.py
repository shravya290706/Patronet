from datetime import datetime, timezone

from sqlalchemy import UUID, CheckConstraint, DateTime, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, uuid_pk


class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = (
        UniqueConstraint("product_id", "store_id", name="uq_inventory_product_store"),
        CheckConstraint("available_stock >= 0", name="ck_inventory_stock_non_negative"),
    )

    id: Mapped[object] = uuid_pk()
    product_id: Mapped[object] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True
    )
    store_id: Mapped[object] = mapped_column(
        UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False, index=True
    )
    available_stock: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc)
    )

    product: Mapped["Product"] = relationship("Product", back_populates="inventory")
    store: Mapped["Store"] = relationship("Store", back_populates="inventory")
