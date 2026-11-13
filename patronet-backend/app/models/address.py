from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import UUID, Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, uuid_pk

if TYPE_CHECKING:
    from app.models.customer import Customer
    from app.models.order import Order


class Address(Base):
    __tablename__ = "addresses"

    id: Mapped[object] = uuid_pk()
    customer_id: Mapped[object] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    address_line: Mapped[str] = mapped_column(Text, nullable=False)
    address_line_2: Mapped[str | None] = mapped_column(Text, nullable=True)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    pincode: Mapped[str] = mapped_column(String(10), nullable=False)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
        nullable=False,
    )

    customer: Mapped["Customer"] = relationship("Customer", back_populates="addresses")
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="address")
