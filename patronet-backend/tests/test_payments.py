import hashlib
import hmac
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, patch
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import create_access_token
from app.db.base import Base
from app.db.database import get_db
from app.main import app
from app.models.address import Address
from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.category import Category
from app.models.customer import Customer
from app.models.gift_card import GiftCard, GiftCardRedemption
from app.models.inventory import Inventory
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.outbox_event import OutboxEvent
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.store import Store
from app.services.gift_card_service import (
    GiftCardException,
    redeem_gift_card,
    seed_demo_gift_cards,
    validate_gift_card,
)
from app.services.razorpay_service import (
    RazorpaySecurityException,
    create_razorpay_order,
    get_payment_config,
    get_razorpay_mode,
    verify_razorpay_signature,
    verify_webhook_signature,
)

_TEST_JWT_SECRET = "payment-tests-jwt-secret-min-32-chars-long"


@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


@dataclass(frozen=True)
class PaymentTestContext:
    client: TestClient
    session_factory: sessionmaker[Session]
    customer_id: UUID
    address_id: UUID
    product_id: UUID
    store_id: UUID
    token: str


@pytest.fixture
def payment_context(monkeypatch: pytest.MonkeyPatch) -> Iterator[PaymentTestContext]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(
        engine,
        tables=[
            Customer.__table__,
            Address.__table__,
            Category.__table__,
            Product.__table__,
            ProductImage.__table__,
            Store.__table__,
            Inventory.__table__,
            Cart.__table__,
            CartItem.__table__,
            GiftCard.__table__,
            GiftCardRedemption.__table__,
            Order.__table__,
            OrderItem.__table__,
            OutboxEvent.__table__,
        ],
    )
    test_session = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)

    with test_session() as db:
        customer = Customer(
            name="Payment Customer",
            email="payment-customer@example.com",
            password_hash="unused-hash",
        )
        category = Category(name="Electronics")
        store = Store(
            name="Store One",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
            address="1 Test Road",
            is_active=True,
        )
        product = Product(
            category=category,
            name="Wireless Headphones",
            description="High quality test headphones",
            brand="AudioTest",
            sku="AUDIO-TEST-1",
            price=Decimal("499.00"),
            is_active=True,
        )
        db.add_all([customer, category, store, product])
        db.flush()

        address = Address(
            customer_id=customer.id,
            full_name="Payment Customer",
            phone="9876543210",
            address_line="10 Tech Street",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
            is_default=True,
        )
        inventory = Inventory(
            product_id=product.id,
            store_id=store.id,
            available_stock=10,
        )
        db.add_all([address, inventory])
        db.commit()

        customer_id = customer.id
        address_id = address.id
        product_id = product.id
        store_id = store.id

    monkeypatch.setattr(settings, "JWT_SECRET_KEY", _TEST_JWT_SECRET)
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "")

    def token_for(c_id: UUID) -> str:
        expires_at = datetime.now(UTC) + timedelta(hours=1)
        return create_access_token(str(c_id), int(expires_at.timestamp()))

    def _override_get_db() -> Iterator[Session]:
        with test_session() as session:
            yield session

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _override_get_db

    try:
        with TestClient(app, raise_server_exceptions=True) as test_client:
            yield PaymentTestContext(
                client=test_client,
                session_factory=test_session,
                customer_id=customer_id,
                address_id=address_id,
                product_id=product_id,
                store_id=store_id,
                token=token_for(customer_id),
            )
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override
        engine.dispose()


# -------------------------------------------------------------------------
# 1. Razorpay Service Unit Tests
# -------------------------------------------------------------------------

def test_razorpay_mode_and_config_mock(monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "")
    assert get_razorpay_mode() == "mock"
    cfg = get_payment_config()
    assert cfg["mode"] == "mock"
    assert cfg["is_test_mode"] is True
    assert cfg["currency"] == "INR"


def test_razorpay_live_keys_prohibited(monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_live_forbidden123")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "live_secret_456")
    with pytest.raises(RazorpaySecurityException, match="strictly for demo/test mode"):
        get_razorpay_mode()


def test_razorpay_test_mode_detection(monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_validkey123")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "test_secret_abc")
    assert get_razorpay_mode() == "test"
    cfg = get_payment_config()
    assert cfg["mode"] == "test"
    assert cfg["razorpay_key_id"] == "rzp_test_validkey123"


def test_razorpay_mock_order_creation():
    order = create_razorpay_order(amount=Decimal("1499.50"), receipt="PAT-1234")
    assert order["mode"] == "mock"
    assert order["id"].startswith("order_mock_")
    assert order["amount"] == 149950
    assert order["currency"] == "INR"


def test_razorpay_test_order_creation_via_api(monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_12345")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "test_secret_67890")

    mock_resp = MagicMock()
    mock_resp.json.return_value = {
        "id": "order_test_998877",
        "amount": 50000,
        "currency": "INR",
        "receipt": "PAT-TEST-1",
    }
    mock_resp.raise_for_status = MagicMock()

    with patch("requests.post", return_value=mock_resp) as mock_post:
        res = create_razorpay_order(amount=Decimal("500.00"), receipt="PAT-TEST-1")
        assert res["id"] == "order_test_998877"
        assert res["mode"] == "test"
        mock_post.assert_called_once()


def test_razorpay_signature_verification_mock():
    mock_order = "order_mock_test123"
    mock_payment = "pay_mock_test456"
    assert verify_razorpay_signature(mock_order, mock_payment, "mock_signature") is True
    assert verify_razorpay_signature(mock_order, mock_payment, f"mock_sig_{mock_order}") is True
    assert verify_razorpay_signature(mock_order, mock_payment, "invalid_sig") is False


def test_razorpay_signature_verification_test_mode(monkeypatch):
    secret = "my_razorpay_test_secret"
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_123")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", secret)

    order_id = "order_rzp_test1"
    payment_id = "pay_rzp_test2"
    msg = f"{order_id}|{payment_id}"
    valid_sig = hmac.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()

    assert verify_razorpay_signature(order_id, payment_id, valid_sig) is True
    assert verify_razorpay_signature(order_id, payment_id, "forged_signature") is False


def test_webhook_signature_verification(monkeypatch):
    monkeypatch.setattr(settings, "RAZORPAY_WEBHOOK_SECRET", "webhook_test_secret")
    payload = b'{"event":"payment.captured"}'
    valid_sig = hmac.new(b"webhook_test_secret", payload, hashlib.sha256).hexdigest()

    assert verify_webhook_signature(payload, valid_sig) is True
    assert verify_webhook_signature(payload, "invalid_sig") is False


# -------------------------------------------------------------------------
# 2. Gift Card Service Unit Tests
# -------------------------------------------------------------------------

def test_gift_card_seeding_and_validation(payment_context: PaymentTestContext):
    with payment_context.session_factory() as db:
        seed_demo_gift_cards(db)
        db.commit()

        # Valid card
        res = validate_gift_card(db, "PATRONET500", Decimal("600.00"))
        assert res["valid"] is True
        assert res["current_balance"] == Decimal("500.00")
        assert res["applicable_amount"] == Decimal("500.00")

        # Partial cart subtotal
        res_partial = validate_gift_card(db, "PATRONET500", Decimal("300.00"))
        assert res_partial["valid"] is True
        assert res_partial["applicable_amount"] == Decimal("300.00")

        # Expired card
        res_exp = validate_gift_card(db, "EXPIRED100", Decimal("500.00"))
        assert res_exp["valid"] is False
        assert "expired" in res_exp["message"].lower()

        # Depleted card
        res_dep = validate_gift_card(db, "DEPLETED0", Decimal("500.00"))
        assert res_dep["valid"] is False
        assert "depleted" in res_dep["message"].lower() or "zero" in res_dep["message"].lower()

        # Non-existent card
        res_invalid = validate_gift_card(db, "DOESNOTEXIST", Decimal("500.00"))
        assert res_invalid["valid"] is False


def test_gift_card_redemption(payment_context: PaymentTestContext):
    with payment_context.session_factory() as db:
        seed_demo_gift_cards(db)
        db.commit()

        redemption = redeem_gift_card(
            db=db,
            code="PATRONET500",
            order_id=None,
            customer_id=payment_context.customer_id,
            amount_to_deduct=Decimal("200.00"),
        )
        db.commit()

        assert redemption.amount_deducted == Decimal("200.00")
        card = db.scalar(select(GiftCard).where(GiftCard.code == "PATRONET500"))
        assert card.current_balance == Decimal("300.00")
        assert card.status == "active"


# -------------------------------------------------------------------------
# 3. Payment & Checkout End-to-End API Tests
# -------------------------------------------------------------------------

def _setup_active_cart(context: PaymentTestContext, quantity: int = 1) -> None:
    headers = {"Authorization": f"Bearer {context.token}"}
    context.client.post(
        "/api/cart/items",
        json={"product_id": str(context.product_id), "quantity": quantity},
        headers=headers,
    )


def test_payment_config_endpoint(payment_context: PaymentTestContext):
    headers = {"Authorization": f"Bearer {payment_context.token}"}
    resp = payment_context.client.get("/api/payments/config", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "razorpay_key_id" in data
    assert data["is_test_mode"] is True
    assert data["currency"] == "INR"


def test_gift_cards_endpoints(payment_context: PaymentTestContext):
    headers = {"Authorization": f"Bearer {payment_context.token}"}

    # Demo cards list
    demo_resp = payment_context.client.get("/api/gift-cards/demo-cards", headers=headers)
    assert demo_resp.status_code == 200
    assert len(demo_resp.json()) >= 3

    # Validate card
    val_resp = payment_context.client.post(
        "/api/gift-cards/validate",
        json={"code": "PATRONET500", "cart_subtotal": "499.00"},
        headers=headers,
    )
    assert val_resp.status_code == 200
    val_data = val_resp.json()
    assert val_data["valid"] is True
    assert Decimal(val_data["applicable_amount"]) == Decimal("499.00")


def test_initiate_checkout_and_verify_payment_flow(payment_context: PaymentTestContext):
    headers = {"Authorization": f"Bearer {payment_context.token}"}
    _setup_active_cart(payment_context, quantity=2)  # 2 * 499.00 = 998.00

    # 1. Initiate checkout without gift card
    init_resp = payment_context.client.post(
        "/api/orders/initiate",
        json={"address_id": str(payment_context.address_id)},
        headers=headers,
    )
    assert init_resp.status_code == 201
    init_data = init_resp.json()
    assert init_data["status"] == "pending_payment"
    assert Decimal(init_data["payable_amount"]) == Decimal("998.00")
    assert init_data["razorpay_order_id"] is not None

    order_id = init_data["order_id"]
    rzp_order_id = init_data["razorpay_order_id"]

    # Verify inventory was NOT deducted yet and cart NOT cleared
    with payment_context.session_factory() as db:
        inv = db.scalar(select(Inventory).where(Inventory.product_id == payment_context.product_id))
        assert inv.available_stock == 10  # Untouched!
        cart = db.scalar(select(Cart).where(Cart.customer_id == payment_context.customer_id))
        assert len(cart.items) == 1  # Cart intact!

    # 2. Verify payment with valid mock signature
    verify_resp = payment_context.client.post(
        "/api/orders/verify-payment",
        json={
            "order_id": order_id,
            "razorpay_order_id": rzp_order_id,
            "razorpay_payment_id": "pay_mock_test123",
            "razorpay_signature": "mock_signature",
        },
        headers=headers,
    )
    assert verify_resp.status_code == 200
    order_data = verify_resp.json()
    assert order_data["status"] == "placed"
    assert order_data["payment_status"] == "paid"
    assert order_data["payment_method"] == "razorpay"
    assert order_data["razorpay_payment_id"] == "pay_mock_test123"

    # Verify inventory WAS deducted and cart WAS cleared
    with payment_context.session_factory() as db:
        inv = db.scalar(select(Inventory).where(Inventory.product_id == payment_context.product_id))
        assert inv.available_stock == 8  # 10 - 2 = 8
        cart = db.scalar(select(Cart).where(Cart.customer_id == payment_context.customer_id))
        assert len(cart.items) == 0  # Cleared!
        outbox = db.scalar(select(OutboxEvent).where(OutboxEvent.aggregate_id == UUID(order_id)))
        assert outbox is not None

    # 3. Idempotency test: calling verify again returns same order without error or double deduction
    verify_again = payment_context.client.post(
        "/api/orders/verify-payment",
        json={
            "order_id": order_id,
            "razorpay_order_id": rzp_order_id,
            "razorpay_payment_id": "pay_mock_test123",
            "razorpay_signature": "mock_signature",
        },
        headers=headers,
    )
    assert verify_again.status_code == 200
    with payment_context.session_factory() as db:
        inv = db.scalar(select(Inventory).where(Inventory.product_id == payment_context.product_id))
        assert inv.available_stock == 8  # Still 8, no duplicate deduction!


def test_initiate_checkout_fully_covered_by_gift_card(payment_context: PaymentTestContext):
    headers = {"Authorization": f"Bearer {payment_context.token}"}
    _setup_active_cart(payment_context, quantity=1)  # 1 * 499.00 = 499.00

    # FESTIVE1000 has 1000.00 balance, which fully covers 499.00
    init_resp = payment_context.client.post(
        "/api/orders/initiate",
        json={
            "address_id": str(payment_context.address_id),
            "gift_card_code": "FESTIVE1000",
        },
        headers=headers,
    )
    assert init_resp.status_code == 201
    init_data = init_resp.json()
    assert init_data["status"] == "placed"  # Fully finalized immediately!
    assert Decimal(init_data["payable_amount"]) == Decimal("0.00")
    assert Decimal(init_data["gift_card_amount"]) == Decimal("499.00")

    # Inventory deducted, cart cleared, gift card balance updated
    with payment_context.session_factory() as db:
        inv = db.scalar(select(Inventory).where(Inventory.product_id == payment_context.product_id))
        assert inv.available_stock == 9  # 10 - 1 = 9
        cart = db.scalar(select(Cart).where(Cart.customer_id == payment_context.customer_id))
        assert len(cart.items) == 0
        card = db.scalar(select(GiftCard).where(GiftCard.code == "FESTIVE1000"))
        assert card.current_balance == Decimal("501.00")  # 1000 - 499 = 501


def test_initiate_checkout_partial_gift_card_and_razorpay(payment_context: PaymentTestContext):
    headers = {"Authorization": f"Bearer {payment_context.token}"}
    _setup_active_cart(payment_context, quantity=2)  # 2 * 499 = 998.00

    # DEMO250 has ₹250 balance
    init_resp = payment_context.client.post(
        "/api/orders/initiate",
        json={
            "address_id": str(payment_context.address_id),
            "gift_card_code": "DEMO250",
        },
        headers=headers,
    )
    assert init_resp.status_code == 201
    init_data = init_resp.json()
    assert init_data["status"] == "pending_payment"
    assert Decimal(init_data["gift_card_amount"]) == Decimal("250.00")
    assert Decimal(init_data["payable_amount"]) == Decimal("748.00")  # 998 - 250 = 748

    # Now verify payment
    verify_resp = payment_context.client.post(
        "/api/orders/verify-payment",
        json={
            "order_id": init_data["order_id"],
            "razorpay_order_id": init_data["razorpay_order_id"],
            "razorpay_payment_id": "pay_mock_split1",
            "razorpay_signature": "mock_signature",
        },
        headers=headers,
    )
    assert verify_resp.status_code == 200
    with payment_context.session_factory() as db:
        card = db.scalar(select(GiftCard).where(GiftCard.code == "DEMO250"))
        assert card.current_balance == Decimal("0.00")
        assert card.status == "depleted"


def test_cancel_payment_attempt(payment_context: PaymentTestContext):
    headers = {"Authorization": f"Bearer {payment_context.token}"}
    _setup_active_cart(payment_context, quantity=1)

    init_resp = payment_context.client.post(
        "/api/orders/initiate",
        json={"address_id": str(payment_context.address_id)},
        headers=headers,
    )
    assert init_resp.status_code == 201
    order_id = init_resp.json()["order_id"]

    cancel_resp = payment_context.client.post(
        "/api/orders/cancel-payment",
        json={"order_id": order_id, "reason": "Customer cancelled modal"},
        headers=headers,
    )
    assert cancel_resp.status_code == 200
    cancel_data = cancel_resp.json()
    assert cancel_data["status"] == "cancelled"

    # Cart and stock remain untouched
    with payment_context.session_factory() as db:
        inv = db.scalar(select(Inventory).where(Inventory.product_id == payment_context.product_id))
        assert inv.available_stock == 10
        cart = db.scalar(select(Cart).where(Cart.customer_id == payment_context.customer_id))
        assert len(cart.items) == 1


def test_demo_checkout_with_payment_method(payment_context: PaymentTestContext):
    headers = {"Authorization": f"Bearer {payment_context.token}"}
    _setup_active_cart(payment_context, quantity=1)

    resp = payment_context.client.post(
        "/api/orders/checkout",
        json={
            "address_id": str(payment_context.address_id),
            "payment_method": "UPI (Google Pay - Demo)",
            "gift_card_code": "DEMO250",
            "gift_card_amount": 250,
        },
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "placed"
    assert data["payment_status"] == "paid"
    assert data["payment_method"] == "UPI (Google Pay - Demo)"
    assert data["gift_card_code"] == "DEMO250"
    assert Decimal(data["gift_card_amount"]) == Decimal("250.00")
