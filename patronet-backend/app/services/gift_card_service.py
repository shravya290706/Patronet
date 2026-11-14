from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.gift_card import GiftCard, GiftCardRedemption


class GiftCardException(Exception):
    """Base exception for gift card operations."""
    pass


def normalize_code(code: str) -> str:
    return (code or "").strip().upper()


def validate_gift_card(
    db: Session,
    code: str,
    cart_subtotal: Decimal = Decimal("0.00"),
) -> dict[str, Any]:
    """Validates gift card existence, active status, expiration, and remaining balance."""
    normalized = normalize_code(code)
    if not normalized:
        return {
            "valid": False,
            "code": "",
            "current_balance": Decimal("0.00"),
            "applicable_amount": Decimal("0.00"),
            "description": None,
            "message": "Gift card code cannot be empty.",
        }

    gift_card = db.scalar(
        select(GiftCard).where(GiftCard.code == normalized)
    )
    if not gift_card:
        return {
            "valid": False,
            "code": normalized,
            "current_balance": Decimal("0.00"),
            "applicable_amount": Decimal("0.00"),
            "description": None,
            "message": "Invalid gift card code.",
        }

    now = datetime.now(timezone.utc)
    if gift_card.status != "active":
        return {
            "valid": False,
            "code": normalized,
            "current_balance": gift_card.current_balance,
            "applicable_amount": Decimal("0.00"),
            "description": gift_card.description,
            "message": f"Gift card is {gift_card.status}.",
        }

    if gift_card.expires_at is not None:
        card_expiry = gift_card.expires_at
        if card_expiry.tzinfo is None:
            card_expiry = card_expiry.replace(tzinfo=timezone.utc)
        if card_expiry < now:
            return {
                "valid": False,
                "code": normalized,
                "current_balance": gift_card.current_balance,
                "applicable_amount": Decimal("0.00"),
                "description": gift_card.description,
                "message": "This gift card has expired.",
            }

    if gift_card.current_balance <= Decimal("0.00"):
        return {
            "valid": False,
            "code": normalized,
            "current_balance": Decimal("0.00"),
            "applicable_amount": Decimal("0.00"),
            "description": gift_card.description,
            "message": "Gift card has zero remaining balance.",
        }

    applicable = min(gift_card.current_balance, cart_subtotal) if cart_subtotal > 0 else gift_card.current_balance
    return {
        "valid": True,
        "code": normalized,
        "current_balance": gift_card.current_balance,
        "applicable_amount": applicable,
        "description": gift_card.description,
        "message": f"Gift card valid. ₹{applicable:.2f} applicable to this order.",
    }


def redeem_gift_card(
    db: Session,
    code: str,
    order_id: UUID,
    customer_id: UUID,
    amount_to_deduct: Decimal,
) -> GiftCardRedemption:
    """Safely locks the gift card row and deducts the balance inside the current transaction."""
    normalized = normalize_code(code)
    gift_card = db.scalar(
        select(GiftCard)
        .where(GiftCard.code == normalized)
        .with_for_update()
    )
    if not gift_card:
        raise GiftCardException("Gift card not found.")

    if gift_card.status != "active":
        raise GiftCardException(f"Gift card is {gift_card.status}.")

    now = datetime.now(timezone.utc)
    if gift_card.expires_at is not None:
        card_expiry = gift_card.expires_at
        if card_expiry.tzinfo is None:
            card_expiry = card_expiry.replace(tzinfo=timezone.utc)
        if card_expiry < now:
            raise GiftCardException("Gift card has expired.")

    if gift_card.current_balance < amount_to_deduct:
        raise GiftCardException("Insufficient gift card balance.")

    gift_card.current_balance -= amount_to_deduct
    if gift_card.current_balance <= Decimal("0.00"):
        gift_card.status = "depleted"

    redemption = GiftCardRedemption(
        gift_card_id=gift_card.id,
        order_id=order_id,
        customer_id=customer_id,
        amount_deducted=amount_to_deduct,
        created_at=now,
    )
    db.add(redemption)
    return redemption


def seed_demo_gift_cards(db: Session) -> list[GiftCard]:
    """Seeds demo gift cards strictly in non-production environments."""
    if settings.APP_ENV.lower() == "production":
        return []
    now = datetime.now(timezone.utc)
    demo_cards = [
        {
            "code": "PATRONET500",
            "initial_balance": Decimal("500.00"),
            "current_balance": Decimal("500.00"),
            "status": "active",
            "description": "PATRONET ₹500 Welcome Gift Card",
            "expires_at": now + timedelta(days=365),
        },
        {
            "code": "FESTIVE1000",
            "initial_balance": Decimal("1000.00"),
            "current_balance": Decimal("1000.00"),
            "status": "active",
            "description": "PATRONET ₹1000 Festive Gift Card",
            "expires_at": now + timedelta(days=180),
        },
        {
            "code": "DEMO250",
            "initial_balance": Decimal("250.00"),
            "current_balance": Decimal("250.00"),
            "status": "active",
            "description": "PATRONET ₹250 Demo Voucher",
            "expires_at": now + timedelta(days=90),
        },
        {
            "code": "EXPIRED100",
            "initial_balance": Decimal("100.00"),
            "current_balance": Decimal("100.00"),
            "status": "active",
            "description": "Expired Demo Card",
            "expires_at": now - timedelta(days=30),
        },
        {
            "code": "DEPLETED0",
            "initial_balance": Decimal("500.00"),
            "current_balance": Decimal("0.00"),
            "status": "depleted",
            "description": "Depleted Demo Card",
            "expires_at": now + timedelta(days=365),
        },
    ]

    created = []
    for data in demo_cards:
        existing = db.scalar(select(GiftCard).where(GiftCard.code == data["code"]))
        if not existing:
            card = GiftCard(**data)
            db.add(card)
            created.append(card)
    if created:
        db.flush()
    return created
