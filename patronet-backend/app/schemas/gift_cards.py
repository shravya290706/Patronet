from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class GiftCardValidateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    code: str = Field(..., min_length=1, max_length=50, description="Gift card code")
    cart_subtotal: Optional[Decimal] = Field(
        default=Decimal("0.00"),
        description="Current cart subtotal to calculate applicable deduction"
    )


class GiftCardValidateResponse(BaseModel):
    valid: bool
    code: str
    current_balance: Decimal
    applicable_amount: Decimal
    description: Optional[str] = None
    message: str
