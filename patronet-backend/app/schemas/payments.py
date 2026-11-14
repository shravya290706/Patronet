from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PaymentConfigResponse(BaseModel):
    razorpay_key_id: str
    mode: str  # "test" | "mock"
    is_test_mode: bool
    currency: str = "INR"


class InitiateCheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    address_id: UUID
    gift_card_code: Optional[str] = Field(default=None, max_length=50)


class InitiateCheckoutResponse(BaseModel):
    order_id: UUID
    order_number: str
    subtotal: Decimal
    gift_card_code: Optional[str] = None
    gift_card_amount: Decimal = Decimal("0.00")
    payable_amount: Decimal
    razorpay_order_id: Optional[str] = None
    currency: str = "INR"
    key_id: str
    mode: str  # "test" | "mock"
    status: str  # "pending_payment" | "placed"


class VerifyPaymentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: UUID
    razorpay_order_id: str = Field(..., max_length=100)
    razorpay_payment_id: str = Field(..., max_length=100)
    razorpay_signature: str = Field(..., max_length=255)


class CancelPaymentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_id: UUID
    reason: Optional[str] = Field(default=None, max_length=255)


class CancelPaymentResponse(BaseModel):
    order_id: UUID
    status: str
    payment_status: str
    message: str
