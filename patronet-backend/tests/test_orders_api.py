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
from app.models.inventory import Inventory
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.outbox_event import OutboxEvent
from app.models.product import Product
from app.models.store import Store

_TEST_JWT_SECRET = "order-tests-use-a-local-signing-secret-of-32-bytes-minimum"


@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


@dataclass(frozen=True)
class OrderTestContext:
    client: TestClient
    session_factory: sessionmaker[Session]
    customer_id: UUID
    other_customer_id: UUID
    address_id: UUID
    product_id: UUID
    active_store_ids: tuple[UUID, UUID]
    inactive_store_id: UUID
    token: str
    other_customer_token: str


@pytest.fixture
def order_context(monkeypatch: pytest.MonkeyPatch) -> Iterator[OrderTestContext]:
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
            Store.__table__,
            Inventory.__table__,
            Cart.__table__,
            CartItem.__table__,
            Order.__table__,
            OrderItem.__table__,
            OutboxEvent.__table__,
        ],
    )
    test_session = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)

    with test_session() as db:
        customer = Customer(
            name="Order Customer",
            email="order-customer@example.com",
            password_hash="unused-test-password-hash",
        )
        other_customer = Customer(
            name="Other Customer",
            email="other-order-customer@example.com",
            password_hash="unused-test-password-hash",
        )
        category = Category(name="Order Test Category")
        store_one = Store(
            name="Active Store One",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
            address="1 Test Road",
            is_active=True,
        )
        store_two = Store(
            name="Active Store Two",
            city="Mysuru",
            state="Karnataka",
            pincode="570001",
            address="2 Test Road",
            is_active=True,
        )
        inactive_store = Store(
            name="Inactive Store",
            city="Bengaluru",
            state="Karnataka",
            pincode="560002",
            address="3 Test Road",
            is_active=False,
        )
        product = Product(
            category=category,
            name="Order Test Product",
            description="A product for isolated checkout tests.",
            brand="Test Brand",
            sku="ORDER-TEST-1",
            price=Decimal("100.25"),
            is_active=True,
        )
        db.add_all(
            [
                customer,
                other_customer,
                category,
                store_one,
                store_two,
                inactive_store,
                product,
            ]
        )
        db.flush()
        address = Address(
            customer_id=customer.id,
            full_name="Order Customer",
            phone="9876543210",
            address_line="10 Sample Street",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
            is_default=True,
        )
        db.add_all(
            [
                address,
                Inventory(
                    product_id=product.id,
                    store_id=store_one.id,
                    available_stock=3,
                ),
                Inventory(
                    product_id=product.id,
                    store_id=store_two.id,
                    available_stock=2,
                ),
                Inventory(
                    product_id=product.id,
                    store_id=inactive_store.id,
                    available_stock=100,
                ),
            ]
        )
        db.commit()
        customer_id = customer.id
        other_customer_id = other_customer.id
        address_id = address.id
        product_id = product.id
        active_store_ids = (store_one.id, store_two.id)
        inactive_store_id = inactive_store.id

    def token_for(customer_id: UUID) -> str:
        expires_at = datetime.now(UTC) + timedelta(hours=1)
        return create_access_token(str(customer_id), int(expires_at.timestamp()))

    def override_get_db() -> Iterator[Session]:
        with test_session() as db:
            yield db

    monkeypatch.setattr(settings, "JWT_SECRET_KEY", _TEST_JWT_SECRET)
    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    try:
        yield OrderTestContext(
            client=TestClient(app, raise_server_exceptions=True),
            session_factory=test_session,
            customer_id=customer_id,
            other_customer_id=other_customer_id,
            address_id=address_id,
            product_id=product_id,
            active_store_ids=active_store_ids,
            inactive_store_id=inactive_store_id,
            token=token_for(customer_id),
            other_customer_token=token_for(other_customer_id),
        )
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override
        engine.dispose()


def _headers(context: OrderTestContext, *, other_customer: bool = False):
    token = (
        context.other_customer_token
        if other_customer
        else context.token
    )
    return {"Authorization": f"Bearer {token}"}


def _create_cart(context: OrderTestContext, quantity: int = 4) -> UUID:
    with context.session_factory() as db:
        cart = Cart(customer_id=context.customer_id, status="active")
        db.add(cart)
        db.flush()
        db.add(
            CartItem(
                cart_id=cart.id,
                product_id=context.product_id,
                quantity=quantity,
            )
        )
        db.commit()
        return cart.id


def _checkout(context: OrderTestContext):
    return context.client.post(
        "/api/orders/checkout",
        headers=_headers(context),
        json={"address_id": str(context.address_id)},
    )


def test_order_endpoints_require_authentication(order_context: OrderTestContext):
    history = order_context.client.get("/api/orders")
    checkout = order_context.client.post(
        "/api/orders/checkout",
        json={"address_id": str(order_context.address_id)},
    )

    assert history.status_code == checkout.status_code == 401


def test_checkout_uses_address_created_and_listed_through_address_api(
    order_context: OrderTestContext,
):
    headers = _headers(order_context)
    created = order_context.client.post(
        "/api/addresses",
        headers=headers,
        json={
            "full_name": "Checkout Test Customer",
            "phone": "9876543210",
            "address_line_1": "1 Checkout Street",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560001",
            "country": "India",
        },
    )
    assert created.status_code == 201
    address_id = created.json()["id"]

    listed = order_context.client.get("/api/addresses", headers=headers)
    assert listed.status_code == 200
    assert any(address["id"] == address_id for address in listed.json())

    _create_cart(order_context, quantity=1)
    checkout = order_context.client.post(
        "/api/orders/checkout",
        headers=headers,
        json={"address_id": address_id},
    )

    assert checkout.status_code == 201
    assert checkout.json()["address_id"] == address_id


def test_checkout_creates_order_outbox_and_deducts_aggregated_stock(
    order_context: OrderTestContext,
):
    _create_cart(order_context, quantity=4)

    response = _checkout(order_context)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "placed"
    assert body["payment_status"] == "simulated"
    assert body["payment_method"] == "simulated"
    assert body["subtotal"] == body["total_amount"] == "401.00"
    assert body["delivery_address"]["city"] == "Bengaluru"
    assert sum(item["quantity"] for item in body["items"]) == 4
    assert {item["unit_price"] for item in body["items"]} == {"100.25"}

    with order_context.session_factory() as db:
        order = db.scalar(select(Order))
        outbox = db.scalar(select(OutboxEvent))
        stock = {
            row.store_id: row.available_stock
            for row in db.scalars(
                select(Inventory).where(
                    Inventory.product_id == order_context.product_id
                )
            ).all()
        }
        cart_items = db.scalars(select(CartItem)).all()

    assert order is not None
    assert outbox is not None
    assert outbox.event_type == "order.placed"
    assert outbox.aggregate_type == "order"
    assert outbox.aggregate_id == order.id
    assert outbox.status == "pending"
    assert outbox.payload["order_id"] == str(order.id)
    assert outbox.payload["customer_id"] == str(order_context.customer_id)
    assert outbox.payload["items"][0]["sku"] == "ORDER-TEST-1"
    assert sorted(stock[store_id] for store_id in order_context.active_store_ids) == [
        0,
        1,
    ]
    assert stock[order_context.inactive_store_id] == 100
    assert cart_items == []


def test_checkout_rejects_empty_cart_and_foreign_address(
    order_context: OrderTestContext,
):
    empty_cart_response = _checkout(order_context)
    _create_cart(order_context)
    foreign_address_response = order_context.client.post(
        "/api/orders/checkout",
        headers=_headers(order_context, other_customer=True),
        json={"address_id": str(order_context.address_id)},
    )

    assert empty_cart_response.status_code == 409
    assert foreign_address_response.status_code == 404


def test_checkout_rejects_insufficient_stock_without_partial_changes(
    order_context: OrderTestContext,
):
    _create_cart(order_context, quantity=6)

    response = _checkout(order_context)

    assert response.status_code == 409
    with order_context.session_factory() as db:
        assert db.scalar(select(Order)) is None
        assert db.scalar(select(OutboxEvent)) is None
        assert db.scalar(select(CartItem)) is not None
        stock = db.scalars(
            select(Inventory.available_stock).where(
                Inventory.product_id == order_context.product_id
            )
        ).all()
    assert sorted(stock) == [2, 3, 100]


def test_checkout_rejects_inactive_product_without_changes(
    order_context: OrderTestContext,
):
    _create_cart(order_context)
    with order_context.session_factory() as db:
        product = db.get(Product, order_context.product_id)
        product.is_active = False
        db.commit()

    response = _checkout(order_context)

    assert response.status_code == 409
    with order_context.session_factory() as db:
        assert db.scalar(select(Order)) is None
        assert db.scalar(select(CartItem)) is not None
        assert db.scalar(select(OutboxEvent)) is None


def test_checkout_uses_current_database_price_and_clears_cart(
    order_context: OrderTestContext,
):
    _create_cart(order_context, quantity=2)
    with order_context.session_factory() as db:
        product = db.get(Product, order_context.product_id)
        product.price = Decimal("77.33")
        db.commit()

    response = _checkout(order_context)

    assert response.status_code == 201
    assert response.json()["subtotal"] == "154.66"
    assert response.json()["total_amount"] == "154.66"
    with order_context.session_factory() as db:
        assert db.scalar(select(CartItem)) is None
        active_stock = db.scalars(
            select(Inventory.available_stock).where(
                Inventory.product_id == order_context.product_id,
                Inventory.store_id.in_(order_context.active_store_ids),
            )
        ).all()
    assert sum(active_stock) == 3


def test_checkout_rolls_back_order_inventory_outbox_and_cart_on_failure(
    order_context: OrderTestContext, monkeypatch: pytest.MonkeyPatch
):
    _create_cart(order_context)

    def fail_after_adding_event(*args, **kwargs):
        original_create_event(*args, **kwargs)
        raise RuntimeError("Simulated outbox failure")

    from app.api import orders as orders_api

    original_create_event = orders_api._create_order_event
    monkeypatch.setattr(orders_api, "_create_order_event", fail_after_adding_event)

    with pytest.raises(RuntimeError, match="Simulated outbox failure"):
        _checkout(order_context)

    with order_context.session_factory() as db:
        assert db.scalar(select(Order)) is None
        assert db.scalar(select(OutboxEvent)) is None
        assert db.scalar(select(CartItem)) is not None
        stock = db.scalars(
            select(Inventory.available_stock).where(
                Inventory.product_id == order_context.product_id
            )
        ).all()
    assert sorted(stock) == [2, 3, 100]


def test_order_history_is_paginated_and_protects_ownership(
    order_context: OrderTestContext,
):
    _create_cart(order_context, quantity=1)
    checkout_response = _checkout(order_context)
    order_id = checkout_response.json()["id"]

    history = order_context.client.get(
        "/api/orders?page=1&page_size=1",
        headers=_headers(order_context),
    )
    detail = order_context.client.get(
        f"/api/orders/{order_id}",
        headers=_headers(order_context),
    )
    other_customer_detail = order_context.client.get(
        f"/api/orders/{order_id}",
        headers=_headers(order_context, other_customer=True),
    )

    assert history.status_code == detail.status_code == 200
    assert history.json()["total"] == 1
    assert history.json()["results"][0]["id"] == order_id
    assert detail.json()["id"] == order_id
    assert detail.json()["items"][0]["quantity"] == 1
    assert detail.json()["total_amount"] == "100.25"
    assert other_customer_detail.status_code == 404
