import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.schemas.payments import PaymentConfigResponse
from app.services.razorpay_service import (
    get_payment_config,
    verify_webhook_signature,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments", tags=["payments"])


@router.get("/config", response_model=PaymentConfigResponse)
def payment_config() -> PaymentConfigResponse:
    """Provides public Razorpay configuration for frontend checkout."""
    cfg = get_payment_config()
    return PaymentConfigResponse(
        razorpay_key_id=cfg["razorpay_key_id"],
        mode=cfg["mode"],
        is_test_mode=cfg["is_test_mode"],
        currency=cfg["currency"],
    )


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None, alias="X-Razorpay-Signature"),
) -> dict[str, Any]:
    """Receives and verifies official Razorpay webhook events."""
    body_bytes = await request.body()
    if not x_razorpay_signature or not verify_webhook_signature(body_bytes, x_razorpay_signature):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook signature.",
        )

    try:
        data = await request.json()
        event = data.get("event")
        logger.info("Verified Razorpay webhook received: %s", event)
        # Webhook acknowledged successfully
        return {"status": "ok", "event": event}
    except Exception as exc:
        logger.error("Error processing webhook payload: %s", exc)
        return {"status": "error", "detail": str(exc)}
