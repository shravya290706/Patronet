from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import create_access_token
from app.db.base import Base
from app.db.database import get_db
from app.main import app
from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.category import Category
from app.models.customer import Customer
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.store import Store

_TEST_JWT_SECRET = "cart-tests-use-a-local-signing-secret-of-32-bytes-minimum"


@dataclass(frozen=True)
class CartTestContext:
    client: TestClient
    session_factory: sessionmaker[Session]
    customer_id: UUID
    other_customer_token: str
    product_id: UUID
    category_id: UUID
    store_id: UUID
    token: str


@pytest.fixture
def cart_context(monkeypatch: pytest.MonkeyPatch) -> Iterator[CartTestContext]:
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
            Category.__table__,
            Product.__table__,
            ProductImage.__table__,
            Store.__table__,
            Inventory.__table__,
            Cart.__table__,
            CartItem.__table__,
        ],
    )
    test_session = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)

    with test_session() as db:
        customer = Customer(
            name="Cart Customer",
            email="cart-customer@example.com",
            password_hash="unused-test-password-hash",
        )
        other_customer = Customer(
            name="Other Customer",
            email="other-customer@example.com",
            password_hash="unused-test-password-hash",
        )
        category = Category(name="Cart Test Category", description="Cart test products")
        active_store = Store(
            name="Active Test Store",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
            address="1 Test Road",
            is_active=True,
        )
        inactive_store = Store(
            name="Inactive Test Store",
            city="Bengaluru",
            state="Karnataka",
            pincode="560002",
            address="2 Test Road",
            is_active=False,
        )
        product = Product(
            category=category,
            name="Cart Test Product",
            description="A product for isolated cart tests.",
            brand="Test Brand",
            sku="CART-TEST-1",
            price=Decimal("125.50"),
            is_active=True,
        )
        db.add_all(
            [customer, other_customer, category, active_store, inactive_store, product]
        )
        db.flush()
        db.add_all(
            [
                ProductImage(
                    product_id=product.id,
                    image_url="https://example.test/cart-product.png",
                    is_primary=True,
                    display_order=0,
                ),
                Inventory(
                    product_id=product.id,
                    store_id=active_store.id,
                    available_stock=5,
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
        product_id = product.id
        category_id = category.id
        store_id = active_store.id

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
        yield CartTestContext(
            client=TestClient(app, raise_server_exceptions=True),
            session_factory=test_session,
            customer_id=customer_id,
            other_customer_token=token_for(other_customer_id),
            product_id=product_id,
            category_id=category_id,
            store_id=store_id,
            token=token_for(customer_id),
        )
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override
        engine.dispose()


def _headers(context: CartTestContext) -> dict[str, str]:
    return {"Authorization": f"Bearer {context.token}"}


def _add_item(
    context: CartTestContext,
    quantity: int = 2,
    product_id: UUID | None = None,
):
    return context.client.post(
        "/api/cart/items",
        headers=_headers(context),
        json={
            "product_id": str(product_id or context.product_id),
            "quantity": quantity,
        },
    )


def test_cart_requires_authentication(cart_context: CartTestContext):
    response = cart_context.client.get("/api/cart")

    assert response.status_code == 401


def test_get_cart_returns_empty_cart_when_none_exists(cart_context: CartTestContext):
    response = cart_context.client.get("/api/cart", headers=_headers(cart_context))

    assert response.status_code == 200
    assert response.json() == {
        "id": None,
        "items": [],
        "total_quantity": 0,
        "subtotal": "0.00",
    }


def test_add_item_creates_cart_and_returns_database_prices_and_images(
    cart_context: CartTestContext,
):
    response = _add_item(cart_context, quantity=2)

    assert response.status_code == 200
    body = response.json()
    assert body["id"]
    assert body["total_quantity"] == 2
    assert body["subtotal"] == "251.00"
    item = body["items"][0]
    assert item["quantity"] == 2
    assert item["unit_price"] == "125.50"
    assert item["subtotal"] == "251.00"
    assert item["product"]["id"] == str(cart_context.product_id)
    assert item["product"]["images"][0]["image_url"] == (
        "https://example.test/cart-product.png"
    )


def test_adding_existing_product_increases_quantity(cart_context: CartTestContext):
    first = _add_item(cart_context, quantity=2)
    second = _add_item(cart_context, quantity=2)

    assert first.status_code == second.status_code == 200
    body = second.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["quantity"] == 4
    assert body["subtotal"] == "502.00"


@pytest.mark.parametrize("quantity", [0, -1])
def test_add_rejects_non_positive_quantity(
    cart_context: CartTestContext, quantity: int
):
    response = _add_item(cart_context, quantity=quantity)

    assert response.status_code == 422


def test_add_rejects_client_supplied_price_or_customer_id(
    cart_context: CartTestContext,
):
    response = cart_context.client.post(
        "/api/cart/items",
        headers=_headers(cart_context),
        json={
            "product_id": str(cart_context.product_id),
            "quantity": 1,
            "price": "0.01",
            "customer_id": str(cart_context.customer_id),
        },
    )

    assert response.status_code == 422


def test_add_rejects_missing_inactive_and_out_of_stock_products(
    cart_context: CartTestContext,
):
    missing_response = _add_item(cart_context, product_id=uuid4())

    with cart_context.session_factory() as db:
        inactive_product = Product(
            category_id=cart_context.category_id,
            name="Inactive Product",
            brand="Test Brand",
            sku="CART-TEST-INACTIVE",
            price=Decimal("10.00"),
            is_active=False,
        )
        db.add(inactive_product)
        db.flush()
        db.add(
            Inventory(
                product_id=inactive_product.id,
                store_id=cart_context.store_id,
                available_stock=5,
            )
        )
        db.commit()
        inactive_product_id = inactive_product.id

    inactive_response = _add_item(cart_context, product_id=inactive_product_id)
    out_of_stock_response = _add_item(cart_context, quantity=6)

    assert missing_response.status_code == 404
    assert inactive_response.status_code == 409
    assert out_of_stock_response.status_code == 409
    with cart_context.session_factory() as db:
        assert db.scalar(select(Cart).where(Cart.customer_id == cart_context.customer_id)) is None


def test_update_item_changes_quantity_and_checks_stock(cart_context: CartTestContext):
    added = _add_item(cart_context, quantity=2)
    item_id = added.json()["items"][0]["id"]

    updated = cart_context.client.patch(
        f"/api/cart/items/{item_id}",
        headers=_headers(cart_context),
        json={"quantity": 3},
    )
    exceeds_stock = cart_context.client.patch(
        f"/api/cart/items/{item_id}",
        headers=_headers(cart_context),
        json={"quantity": 6},
    )

    assert updated.status_code == 200
    assert updated.json()["items"][0]["quantity"] == 3
    assert updated.json()["subtotal"] == "376.50"
    assert exceeds_stock.status_code == 409
    current = cart_context.client.get("/api/cart", headers=_headers(cart_context))
    assert current.json()["items"][0]["quantity"] == 3


def test_update_rejects_non_positive_quantity(cart_context: CartTestContext):
    added = _add_item(cart_context)
    item_id = added.json()["items"][0]["id"]

    response = cart_context.client.patch(
        f"/api/cart/items/{item_id}",
        headers=_headers(cart_context),
        json={"quantity": 0},
    )

    assert response.status_code == 422


def test_item_cannot_be_updated_or_deleted_by_another_customer(
    cart_context: CartTestContext,
):
    added = _add_item(cart_context)
    item_id = added.json()["items"][0]["id"]
    other_headers = {
        "Authorization": f"Bearer {cart_context.other_customer_token}"
    }

    update_response = cart_context.client.patch(
        f"/api/cart/items/{item_id}",
        headers=other_headers,
        json={"quantity": 1},
    )
    delete_response = cart_context.client.delete(
        f"/api/cart/items/{item_id}",
        headers=other_headers,
    )

    assert update_response.status_code == 404
    assert delete_response.status_code == 404
    assert (
        cart_context.client.get("/api/cart", headers=_headers(cart_context))
        .json()["items"][0]["quantity"]
        == 2
    )


def test_delete_item_removes_it_without_deducting_inventory(
    cart_context: CartTestContext,
):
    added = _add_item(cart_context)
    item_id = added.json()["items"][0]["id"]

    response = cart_context.client.delete(
        f"/api/cart/items/{item_id}",
        headers=_headers(cart_context),
    )

    assert response.status_code == 204
    assert cart_context.client.get(
        "/api/cart", headers=_headers(cart_context)
    ).json()["items"] == []
    with cart_context.session_factory() as db:
        stock = db.scalar(
            select(Inventory.available_stock).where(
                Inventory.product_id == cart_context.product_id,
                Inventory.store_id == cart_context.store_id,
            )
        )
        assert stock == 5


def test_clear_cart_removes_all_items_and_is_idempotent(
    cart_context: CartTestContext,
):
    _add_item(cart_context)

    first_delete = cart_context.client.delete(
        "/api/cart", headers=_headers(cart_context)
    )
    second_delete = cart_context.client.delete(
        "/api/cart", headers=_headers(cart_context)
    )
    empty_cart = cart_context.client.get(
        "/api/cart", headers=_headers(cart_context)
    )

    assert first_delete.status_code == second_delete.status_code == 204
    assert empty_cart.status_code == 200
    assert empty_cart.json()["items"] == []
    assert empty_cart.json()["total_quantity"] == 0
