from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.auth import get_current_customer
from app.core.config import settings
from app.db.database import get_db
from app.models.customer import Customer
from app.schemas.gift_cards import (
    GiftCardValidateRequest,
    GiftCardValidateResponse,
)
from app.services.gift_card_service import (
    seed_demo_gift_cards,
    validate_gift_card,
)

router = APIRouter(prefix="/api/gift-cards", tags=["gift-cards"])


@router.post("/validate", response_model=GiftCardValidateResponse)
def validate_code(
    payload: GiftCardValidateRequest,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> GiftCardValidateResponse:
    # Ensure demo gift cards exist in dev/test environment
    seed_demo_gift_cards(db)
    result = validate_gift_card(
        db=db,
        code=payload.code,
        cart_subtotal=payload.cart_subtotal or 0,
    )
    return GiftCardValidateResponse(
        valid=result["valid"],
        code=result["code"],
        current_balance=result["current_balance"],
        applicable_amount=result["applicable_amount"],
        description=result.get("description"),
        message=result["message"],
    )


@router.get("/demo-cards")
def get_demo_cards(
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    """Convenience endpoint returning available demo cards for testing in demo environment."""
    if settings.APP_ENV.lower() == "production":
        return []
    seed_demo_gift_cards(db)
    return [
        {"code": "PATRONET500", "balance": "500.00", "description": "PATRONET ₹500 Welcome Gift Card"},
        {"code": "FESTIVE1000", "balance": "1000.00", "description": "PATRONET ₹1000 Festive Gift Card"},
        {"code": "DEMO250", "balance": "250.00", "description": "PATRONET ₹250 Demo Voucher"},
    ]
