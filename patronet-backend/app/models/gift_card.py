from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import UUID, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, uuid_pk


class GiftCard(Base):
    __tablename__ = "gift_cards"

    id: Mapped[object] = uuid_pk()
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    initial_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    current_balance: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    redemptions: Mapped[list["GiftCardRedemption"]] = relationship(
        "GiftCardRedemption", back_populates="gift_card", cascade="all, delete-orphan"
    )


class GiftCardRedemption(Base):
    __tablename__ = "gift_card_redemptions"

    id: Mapped[object] = uuid_pk()
    gift_card_id: Mapped[object] = mapped_column(
        UUID(as_uuid=True), ForeignKey("gift_cards.id", ondelete="CASCADE"), nullable=False, index=True
    )
    order_id: Mapped[object | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="SET NULL"), nullable=True, index=True
    )
    customer_id: Mapped[object] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    amount_deducted: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    gift_card: Mapped["GiftCard"] = relationship("GiftCard", back_populates="redemptions")
