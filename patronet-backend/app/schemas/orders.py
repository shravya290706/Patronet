from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class CheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    address_id: UUID
    payment_method: str | None = None
    gift_card_code: str | None = None
    gift_card_amount: Decimal | None = None


class OrderAddressSnapshot(BaseModel):
    full_name: str | None
    phone: str | None
    address_line: str | None
    city: str | None
    state: str | None
    pincode: str | None


class OrderItemResponse(BaseModel):
    id: UUID
    product_id: UUID
    store_id: UUID
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class OrderResponse(BaseModel):
    id: UUID
    order_number: str
    status: str
    payment_status: str
    payment_method: str | None
    address_id: UUID
    delivery_address: OrderAddressSnapshot
    items: list[OrderItemResponse]
    subtotal: Decimal
    total_amount: Decimal
    razorpay_order_id: str | None = None
    razorpay_payment_id: str | None = None
    gift_card_code: str | None = None
    gift_card_amount: Decimal = Decimal("0.00")
    payable_amount: Decimal | None = None
    created_at: datetime


class PaginatedOrders(BaseModel):
    total: int
    page: int
    page_size: int
    results: list[OrderResponse]


class OrderEventItem(BaseModel):
    product_id: UUID
    product_name: str
    sku: str
    store_id: UUID
    quantity: int
    unit_price: Decimal
    subtotal: Decimal


class OrderEventPayload(BaseModel):
    order_id: UUID
    customer_id: UUID
    order_number: str
    event_type: Literal["order.placed"]
    status: str
    payment_status: str
    payment_method: str
    subtotal: Decimal
    total_amount: Decimal
    delivery_address: OrderAddressSnapshot
    items: list[OrderEventItem]
