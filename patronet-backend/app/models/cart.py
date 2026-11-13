from datetime import datetime, timezone

from sqlalchemy import UUID, DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, uuid_pk


class Cart(Base):
    __tablename__ = "carts"
    __table_args__ = (
        # One active cart per customer enforced at DB level
        Index(
            "uq_carts_customer_active",
            "customer_id",
            unique=True,
            postgresql_where="status = 'active'",
        ),
    )

    id: Mapped[object] = uuid_pk()
    customer_id: Mapped[object] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="carts")
    items: Mapped[list["CartItem"]] = relationship("CartItem", back_populates="cart")
