import hashlib
import hmac
import logging
from decimal import Decimal
from typing import Any
from uuid import uuid4

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"
MOCK_SECRET = "patronet_mock_secret"


class RazorpaySecurityException(Exception):
    """Raised when unsafe payment operations (such as live keys) are attempted."""
    pass


def get_razorpay_mode() -> str:
    """Returns 'test' if valid test keys are set, otherwise 'mock'."""
    key_id = (settings.RAZORPAY_KEY_ID or "").strip()
    key_secret = (settings.RAZORPAY_KEY_SECRET or "").strip()
    if key_id and key_secret:
        if key_id.startswith("rzp_live"):
            raise RazorpaySecurityException(
                "PATRONET is configured strictly for demo/test mode. Live Razorpay keys are prohibited."
            )
        return "test"
    return "mock"


def get_payment_config() -> dict[str, Any]:
    """Returns safe public payment configuration for client checkout."""
    mode = get_razorpay_mode()
    return {
        "razorpay_key_id": settings.RAZORPAY_KEY_ID if mode == "test" else "rzp_test_mock_patronet",
        "mode": mode,
        "is_test_mode": True,
        "currency": "INR",
    }


def create_razorpay_order(
    amount: Decimal,
    receipt: str,
    notes: dict[str, str] | None = None,
) -> dict[str, Any]:
    """Creates a Razorpay order in Test Mode, or generates a local mock order if keys are unset."""
    mode = get_razorpay_mode()
    amount_paise = int((amount * 100).to_integral_value())

    if mode == "test":
        payload = {
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt[:40],
            "notes": notes or {},
            "payment_capture": 1,
        }
        try:
            resp = requests.post(
                RAZORPAY_ORDERS_URL,
                json=payload,
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
                timeout=10,
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "id": data["id"],
                "amount": data["amount"],
                "currency": data["currency"],
                "receipt": data.get("receipt", receipt),
                "mode": "test",
            }
        except requests.RequestException as exc:
            logger.error("Failed to create Razorpay test order: %s", exc)
            raise RuntimeError(f"Razorpay order creation failed: {exc}") from exc

    # Free Local Mock Mode
    mock_order_id = f"order_mock_{uuid4().hex[:14]}"
    logger.info("Created local mock Razorpay order: %s for amount: %s", mock_order_id, amount)
    return {
        "id": mock_order_id,
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "mode": "mock",
    }


def verify_razorpay_signature(
    razorpay_order_id: str,
    razorpay_payment_id: str,
    razorpay_signature: str,
) -> bool:
    """Verifies Razorpay payment signature idempotently and securely."""
    if not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
        return False

    mode = get_razorpay_mode()

    if mode == "test":
        secret = (settings.RAZORPAY_KEY_SECRET or "").strip().encode()
        msg = f"{razorpay_order_id}|{razorpay_payment_id}".encode()
        expected = hmac.new(secret, msg, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, razorpay_signature)

    # In mock mode, support test suite / mock signatures
    if razorpay_order_id.startswith("order_mock_") or mode == "mock":
        # Check mock hmac or standard mock tokens
        msg = f"{razorpay_order_id}|{razorpay_payment_id}".encode()
        expected_mock = hmac.new(MOCK_SECRET.encode(), msg, hashlib.sha256).hexdigest()
        if hmac.compare_digest(expected_mock, razorpay_signature):
            return True
        if razorpay_signature in {"mock_signature", f"mock_sig_{razorpay_order_id}", f"mock_sig_{razorpay_payment_id}"}:
            return True

    return False


def verify_webhook_signature(payload_body: bytes, signature: str) -> bool:
    """Verifies Razorpay webhook signature using RAZORPAY_WEBHOOK_SECRET."""
    secret = (settings.RAZORPAY_WEBHOOK_SECRET or "").strip().encode()
    if not secret or not signature:
        return False
    expected = hmac.new(secret, payload_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)
