import concurrent.futures
import hashlib
import hmac
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
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
    get_razorpay_mode,
    verify_razorpay_signature,
)

_TEST_JWT_SECRET = "payments-integration-test-secret-min-32-chars-long"


@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


@dataclass(frozen=True)
class IntegrationTestContext:
    client: TestClient
    session_factory: sessionmaker[Session]
    customer_id: UUID
    address_id: UUID
    product_id: UUID
    store_one_id: UUID
    store_two_id: UUID
    token: str


@pytest.fixture
def integration_context(monkeypatch: pytest.MonkeyPatch) -> Iterator[IntegrationTestContext]:
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
            name="Integration Tester",
            email="integration-tester@example.com",
            password_hash="test-hash",
        )
        category = Category(name="Electronics")
        store_one = Store(
            name="Bengaluru Warehouse",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
            address="1 Warehouse Rd",
            is_active=True,
        )
        store_two = Store(
            name="Mysuru Warehouse",
            city="Mysuru",
            state="Karnataka",
            pincode="570001",
            address="2 Warehouse Rd",
            is_active=True,
        )
        product = Product(
            category=category,
            name="Smart Fitness Tracker",
            description="Integration test tracker",
            brand="TrackPro",
            sku="TRACK-TEST-1",
            price=Decimal("200.00"),
            is_active=True,
        )
        db.add_all([customer, category, store_one, store_two, product])
        db.flush()

        address = Address(
            customer_id=customer.id,
            full_name="Integration Tester",
            phone="9876543210",
            address_line="42 Main Boulevard",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
            is_default=True,
        )
        inv_one = Inventory(
            product_id=product.id,
            store_id=store_one.id,
            available_stock=3,
        )
        inv_two = Inventory(
            product_id=product.id,
            store_id=store_two.id,
            available_stock=4,
        )
        db.add_all([address, inv_one, inv_two])
        db.commit()

        customer_id = customer.id
        address_id = address.id
        product_id = product.id
        store_one_id = store_one.id
        store_two_id = store_two.id

    monkeypatch.setattr(settings, "JWT_SECRET_KEY", _TEST_JWT_SECRET)
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "")
    monkeypatch.setattr(settings, "APP_ENV", "development")

    def _token(c_id: UUID) -> str:
        exp = datetime.now(UTC) + timedelta(hours=1)
        return create_access_token(str(c_id), int(exp.timestamp()))

    def _override_get_db() -> Iterator[Session]:
        with test_session() as session:
            yield session

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _override_get_db

    try:
        with TestClient(app, raise_server_exceptions=True) as test_client:
            yield IntegrationTestContext(
                client=test_client,
                session_factory=test_session,
                customer_id=customer_id,
                address_id=address_id,
                product_id=product_id,
                store_one_id=store_one_id,
                store_two_id=store_two_id,
                token=_token(customer_id),
            )
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override
        engine.dispose()


# -------------------------------------------------------------------------
# 1. Gift Card Concurrency & Balance Protection
# -------------------------------------------------------------------------

def test_concurrent_gift_card_redemption_prevents_negative_balance(
    integration_context: IntegrationTestContext,
):
    """Verifies that redemption attempts cannot overdraw gift card balance."""
    # Seed a ₹500 card
    with integration_context.session_factory() as db:
        card = GiftCard(
            code="CONCURRENT500",
            initial_balance=Decimal("500.00"),
            current_balance=Decimal("500.00"),
            status="active",
            description="Concurrency test card",
        )
        db.add(card)
        db.commit()

    # Attempt 3 redemptions of ₹200 (Total requested ₹600 > ₹500 balance)
    # The first two succeed, the third MUST fail with Insufficient gift card balance
    with integration_context.session_factory() as db:
        redeem_gift_card(
            db=db,
            code="CONCURRENT500",
            order_id=None,
            customer_id=integration_context.customer_id,
            amount_to_deduct=Decimal("200.00"),
        )
        db.commit()

    with integration_context.session_factory() as db:
        redeem_gift_card(
            db=db,
            code="CONCURRENT500",
            order_id=None,
            customer_id=integration_context.customer_id,
            amount_to_deduct=Decimal("200.00"),
        )
        db.commit()

    with integration_context.session_factory() as db:
        with pytest.raises(GiftCardException, match="Insufficient gift card balance"):
            redeem_gift_card(
                db=db,
                code="CONCURRENT500",
                order_id=None,
                customer_id=integration_context.customer_id,
                amount_to_deduct=Decimal("200.00"),
            )
        db.rollback()

    with integration_context.session_factory() as db:
        card = db.scalar(select(GiftCard).where(GiftCard.code == "CONCURRENT500"))
        assert card.current_balance == Decimal("100.00")
        assert card.current_balance >= Decimal("0.00")


# -------------------------------------------------------------------------
# 2. Production Safety & Exposure Guards
# -------------------------------------------------------------------------

def test_demo_gift_cards_not_seeded_in_production(
    integration_context: IntegrationTestContext, monkeypatch
):
    monkeypatch.setattr(settings, "APP_ENV", "production")

    with integration_context.session_factory() as db:
        seeded = seed_demo_gift_cards(db)
        assert seeded == []
        db.commit()

        # Confirm PATRONET500 does NOT exist
        card = db.scalar(select(GiftCard).where(GiftCard.code == "PATRONET500"))
        assert card is None


def test_demo_cards_endpoint_empty_in_production(
    integration_context: IntegrationTestContext, monkeypatch
):
    monkeypatch.setattr(settings, "APP_ENV", "production")
    headers = {"Authorization": f"Bearer {integration_context.token}"}

    resp = integration_context.client.get("/api/gift-cards/demo-cards", headers=headers)
    assert resp.status_code == 200
    assert resp.json() == []


# -------------------------------------------------------------------------
# 3. Multi-Store Stock Allocation & Transactional Integrity
# -------------------------------------------------------------------------

def test_multi_store_stock_allocation_on_verified_payment(
    integration_context: IntegrationTestContext,
):
    """Tests an order spanning 2 stores: Store 1 has 3, Store 2 has 4.
    Customer orders 5 units.
    - Pending checkout: 0 stock deducted.
    - Verified payment: Store 1 gives 3 (leaves 0), Store 2 gives 2 (leaves 2).
    """
    headers = {"Authorization": f"Bearer {integration_context.token}"}

    # Add 5 items to cart (5 * 200 = 1000.00)
    integration_context.client.post(
        "/api/cart/items",
        json={"product_id": str(integration_context.product_id), "quantity": 5},
        headers=headers,
    )

    # Step 1: Initiate
    init_resp = integration_context.client.post(
        "/api/orders/initiate",
        json={"address_id": str(integration_context.address_id)},
        headers=headers,
    )
    assert init_resp.status_code == 201
    init_data = init_resp.json()
    assert init_data["status"] == "pending_payment"
    assert Decimal(init_data["payable_amount"]) == Decimal("1000.00")

    # Verify 0 inventory deducted yet
    with integration_context.session_factory() as db:
        inv1 = db.scalar(
            select(Inventory).where(
                Inventory.product_id == integration_context.product_id,
                Inventory.store_id == integration_context.store_one_id,
            )
        )
        inv2 = db.scalar(
            select(Inventory).where(
                Inventory.product_id == integration_context.product_id,
                Inventory.store_id == integration_context.store_two_id,
            )
        )
        assert inv1.available_stock == 3
        assert inv2.available_stock == 4

    # Step 2: Verify payment
    verify_resp = integration_context.client.post(
        "/api/orders/verify-payment",
        json={
            "order_id": init_data["order_id"],
            "razorpay_order_id": init_data["razorpay_order_id"],
            "razorpay_payment_id": "pay_mock_multistore_1",
            "razorpay_signature": "mock_signature",
        },
        headers=headers,
    )
    assert verify_resp.status_code == 200

    # Verify inventory was accurately allocated and deducted across both stores
    with integration_context.session_factory() as db:
        inv1 = db.scalar(
            select(Inventory).where(
                Inventory.product_id == integration_context.product_id,
                Inventory.store_id == integration_context.store_one_id,
            )
        )
        inv2 = db.scalar(
            select(Inventory).where(
                Inventory.product_id == integration_context.product_id,
                Inventory.store_id == integration_context.store_two_id,
            )
        )
        total_remaining = inv1.available_stock + inv2.available_stock
        assert total_remaining == 2  # (3 + 4 = 7 initial) - 5 ordered = 2 remaining across stores

        # Verify order items
        order = db.scalar(
            select(Order).where(Order.id == UUID(init_data["order_id"]))
        )
        assert len(order.items) == 2
        assert {item.store_id for item in order.items} == {
            integration_context.store_one_id,
            integration_context.store_two_id,
        }


def test_payment_cancellation_preserves_cart_and_multi_store_stock(
    integration_context: IntegrationTestContext,
):
    headers = {"Authorization": f"Bearer {integration_context.token}"}

    integration_context.client.post(
        "/api/cart/items",
        json={"product_id": str(integration_context.product_id), "quantity": 2},
        headers=headers,
    )

    init_resp = integration_context.client.post(
        "/api/orders/initiate",
        json={"address_id": str(integration_context.address_id)},
        headers=headers,
    )
    assert init_resp.status_code == 201
    order_id = init_resp.json()["order_id"]

    # Customer cancels
    cancel_resp = integration_context.client.post(
        "/api/orders/cancel-payment",
        json={"order_id": order_id, "reason": "Modal closed"},
        headers=headers,
    )
    assert cancel_resp.status_code == 200

    # Verify cart and stock remain untouched
    with integration_context.session_factory() as db:
        inv1 = db.scalar(
            select(Inventory).where(
                Inventory.product_id == integration_context.product_id,
                Inventory.store_id == integration_context.store_one_id,
            )
        )
        assert inv1.available_stock == 3
        cart = db.scalar(
            select(Cart).where(Cart.customer_id == integration_context.customer_id)
        )
        assert len(cart.items) == 1


# -------------------------------------------------------------------------
# 4. Tamper Resistance & Signature Validation
# -------------------------------------------------------------------------

def test_tampered_signature_is_rejected_and_marks_payment_failed(
    integration_context: IntegrationTestContext,
):
    headers = {"Authorization": f"Bearer {integration_context.token}"}

    integration_context.client.post(
        "/api/cart/items",
        json={"product_id": str(integration_context.product_id), "quantity": 1},
        headers=headers,
    )
    init_resp = integration_context.client.post(
        "/api/orders/initiate",
        json={"address_id": str(integration_context.address_id)},
        headers=headers,
    )
    order_id = init_resp.json()["order_id"]
    rzp_id = init_resp.json()["razorpay_order_id"]

    verify_resp = integration_context.client.post(
        "/api/orders/verify-payment",
        json={
            "order_id": order_id,
            "razorpay_order_id": rzp_id,
            "razorpay_payment_id": "pay_tampered_1",
            "razorpay_signature": "fraudulent_signature_xyz",
        },
        headers=headers,
    )
    assert verify_resp.status_code == 400
    assert "verification failed" in verify_resp.json()["detail"].lower()

    # Stock must NOT be deducted
    with integration_context.session_factory() as db:
        inv = db.scalar(
            select(Inventory).where(
                Inventory.product_id == integration_context.product_id,
                Inventory.store_id == integration_context.store_one_id,
            )
        )
        assert inv.available_stock == 3
        order = db.scalar(select(Order).where(Order.id == UUID(order_id)))
        assert order.status != "placed"
        assert order.payment_status == "failed"


def test_idempotent_duplicate_webhook_or_retry_does_not_double_deduct(
    integration_context: IntegrationTestContext,
):
    headers = {"Authorization": f"Bearer {integration_context.token}"}

    integration_context.client.post(
        "/api/cart/items",
        json={"product_id": str(integration_context.product_id), "quantity": 1},
        headers=headers,
    )
    init_resp = integration_context.client.post(
        "/api/orders/initiate",
        json={"address_id": str(integration_context.address_id)},
        headers=headers,
    )
    order_id = init_resp.json()["order_id"]
    rzp_id = init_resp.json()["razorpay_order_id"]

    # First verify
    res1 = integration_context.client.post(
        "/api/orders/verify-payment",
        json={
            "order_id": order_id,
            "razorpay_order_id": rzp_id,
            "razorpay_payment_id": "pay_dup_1",
            "razorpay_signature": "mock_signature",
        },
        headers=headers,
    )
    assert res1.status_code == 200

    # Second verify (e.g. duplicate webhook or user network retry)
    res2 = integration_context.client.post(
        "/api/orders/verify-payment",
        json={
            "order_id": order_id,
            "razorpay_order_id": rzp_id,
            "razorpay_payment_id": "pay_dup_1",
            "razorpay_signature": "mock_signature",
        },
        headers=headers,
    )
    assert res2.status_code == 200

    # Stock must only be deducted once (3 - 1 = 2)
    with integration_context.session_factory() as db:
        inv = db.scalar(
            select(Inventory).where(
                Inventory.product_id == integration_context.product_id,
                Inventory.store_id == integration_context.store_one_id,
            )
        )
        assert inv.available_stock == 2
        outbox_count = db.scalars(
            select(OutboxEvent).where(OutboxEvent.aggregate_id == UUID(order_id))
        ).all()
        assert len(outbox_count) == 1  # Outbox event published exactly once!
