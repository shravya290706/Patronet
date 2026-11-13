from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, uuid_pk


class Store(Base):
    __tablename__ = "stores"

    id: Mapped[object] = uuid_pk()
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    pincode: Mapped[str] = mapped_column(String(10), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    inventory: Mapped[list["Inventory"]] = relationship("Inventory", back_populates="store")
    order_items: Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="store")
