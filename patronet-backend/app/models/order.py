from datetime import datetime, timezone

from sqlalchemy import UUID, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, uuid_pk


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[object] = uuid_pk()
    customer_id: Mapped[object] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    address_id: Mapped[object] = mapped_column(
        UUID(as_uuid=True), ForeignKey("addresses.id", ondelete="RESTRICT"), nullable=False
    )
    order_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    total_amount: Mapped[object] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    payment_status: Mapped[str] = mapped_column(String(30), nullable=False)
    payment_method: Mapped[str | None] = mapped_column(String(30), nullable=True)

    # Address snapshot — preserves delivery details even if address is later changed/deleted
    snapshot_full_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    snapshot_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    snapshot_address_line: Mapped[str | None] = mapped_column(Text, nullable=True)
    snapshot_city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    snapshot_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    snapshot_pincode: Mapped[str | None] = mapped_column(String(10), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    customer: Mapped["Customer"] = relationship("Customer", back_populates="orders")
    address: Mapped["Address"] = relationship("Address", back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="order")
