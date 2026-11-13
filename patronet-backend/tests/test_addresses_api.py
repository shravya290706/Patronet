from collections.abc import Iterator
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import create_access_token
from app.db.base import Base
from app.db.database import get_db
from app.main import app
from app.models.address import Address
from app.models.customer import Customer
from app.models.order import Order

_TEST_JWT_SECRET = "address-tests-use-a-local-signing-secret-of-32-bytes-minimum"


@dataclass(frozen=True)
class AddressTestContext:
    client: TestClient
    session_factory: sessionmaker[Session]
    customer_id: UUID
    other_customer_id: UUID
    token: str
    other_customer_token: str


@pytest.fixture
def address_context(monkeypatch: pytest.MonkeyPatch) -> Iterator[AddressTestContext]:
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
        tables=[Customer.__table__, Address.__table__, Order.__table__],
    )
    test_session = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)

    with test_session() as db:
        customer = Customer(
            name="Address Customer",
            email="address-customer@example.com",
            password_hash="unused-test-password-hash",
        )
        other_customer = Customer(
            name="Other Customer",
            email="other-address-customer@example.com",
            password_hash="unused-test-password-hash",
        )
        db.add_all([customer, other_customer])
        db.commit()
        customer_id = customer.id
        other_customer_id = other_customer.id

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
        yield AddressTestContext(
            client=TestClient(app, raise_server_exceptions=True),
            session_factory=test_session,
            customer_id=customer_id,
            other_customer_id=other_customer_id,
            token=token_for(customer_id),
            other_customer_token=token_for(other_customer_id),
        )
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override
        engine.dispose()


def _headers(context: AddressTestContext, *, other_customer: bool = False):
    token = (
        context.other_customer_token
        if other_customer
        else context.token
    )
    return {"Authorization": f"Bearer {token}"}


def _payload(**overrides):
    payload = {
        "full_name": "Patronet Customer",
        "phone": "9876543210",
        "address_line_1": "10 Sample Street",
        "address_line_2": "Apartment 4B",
        "city": "Bengaluru",
        "state": "Karnataka",
        "pincode": "560001",
        "country": "India",
        "label": "Home",
        "is_default": False,
    }
    payload.update(overrides)
    return payload


def _create_address(
    context: AddressTestContext,
    **overrides,
) -> dict:
    response = context.client.post(
        "/api/addresses",
        headers=_headers(context),
        json=_payload(**overrides),
    )
    assert response.status_code == 201
    return response.json()


def test_address_endpoints_require_authentication(address_context: AddressTestContext):
    list_response = address_context.client.get("/api/addresses")
    create_response = address_context.client.post(
        "/api/addresses",
        json=_payload(),
    )

    assert list_response.status_code == create_response.status_code == 401


def test_create_and_get_address_round_trip_all_fields(
    address_context: AddressTestContext,
):
    created = _create_address(address_context, is_default=True)
    response = address_context.client.get(
        f"/api/addresses/{created['id']}",
        headers=_headers(address_context),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["full_name"] == "Patronet Customer"
    assert body["address_line_1"] == "10 Sample Street"
    assert body["address_line_2"] == "Apartment 4B"
    assert body["country"] == "India"
    assert body["label"] == "Home"
    assert body["is_default"] is True
    assert body["created_at"]
    assert "customer_id" not in body


def test_list_returns_only_owned_addresses_with_default_first(
    address_context: AddressTestContext,
):
    first = _create_address(address_context, label="First")
    second = _create_address(address_context, label="Second", is_default=True)
    other_create = address_context.client.post(
        "/api/addresses",
        headers=_headers(address_context, other_customer=True),
        json=_payload(label="Other customer's address"),
    )
    assert other_create.status_code == 201

    response = address_context.client.get(
        "/api/addresses",
        headers=_headers(address_context),
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body] == [second["id"], first["id"]]
    assert [item["is_default"] for item in body] == [True, False]


def test_create_and_patch_default_keep_only_one_default(
    address_context: AddressTestContext,
):
    first = _create_address(address_context, is_default=True)
    second = _create_address(address_context, is_default=True)

    assert second["is_default"] is True
    response = address_context.client.patch(
        f"/api/addresses/{first['id']}",
        headers=_headers(address_context),
        json={"is_default": True, "label": "Primary"},
    )
    addresses = address_context.client.get(
        "/api/addresses",
        headers=_headers(address_context),
    ).json()

    assert response.status_code == 200
    assert response.json()["label"] == "Primary"
    assert [item["is_default"] for item in addresses].count(True) == 1
    assert next(item for item in addresses if item["id"] == first["id"])["is_default"]


def test_set_default_endpoint_changes_default_address(
    address_context: AddressTestContext,
):
    first = _create_address(address_context, is_default=True)
    second = _create_address(address_context)

    response = address_context.client.patch(
        f"/api/addresses/{second['id']}/default",
        headers=_headers(address_context),
    )
    addresses = address_context.client.get(
        "/api/addresses",
        headers=_headers(address_context),
    ).json()

    assert response.status_code == 200
    assert response.json()["is_default"] is True
    assert [item["is_default"] for item in addresses].count(True) == 1
    assert next(item for item in addresses if item["id"] == first["id"])["is_default"] is False


def test_patch_updates_partial_fields_and_can_clear_optional_values(
    address_context: AddressTestContext,
):
    address = _create_address(address_context)

    response = address_context.client.patch(
        f"/api/addresses/{address['id']}",
        headers=_headers(address_context),
        json={
            "address_line_1": "22 Updated Road",
            "address_line_2": None,
            "country": "India",
            "label": None,
        },
    )

    assert response.status_code == 200
    assert response.json()["address_line_1"] == "22 Updated Road"
    assert response.json()["address_line_2"] is None
    assert response.json()["label"] is None


@pytest.mark.parametrize(
    "payload",
    [
        {"full_name": " ", "phone": "9876543210", "address_line_1": "1 Road",
         "city": "Pune", "state": "Maharashtra", "pincode": "411001",
         "country": "India"},
        {"full_name": "Customer", "phone": "9876543210", "address_line_1": "1 Road",
         "city": "Pune", "state": "Maharashtra", "pincode": "411001",
         "country": "India", "customer_id": str(uuid4())},
        {"full_name": "Customer", "phone": "9876543210", "address_line_1": "1 Road",
         "city": "Pune", "state": "Maharashtra", "pincode": "411001"},
        {"full_name": "Customer", "phone": "9876543210", "address_line_1": "1 Road",
         "city": "Pune", "state": "Maharashtra", "pincode": "411001",
         "country": "I" * 101},
    ],
)
def test_create_rejects_invalid_or_untrusted_fields(
    address_context: AddressTestContext,
    payload: dict,
):
    response = address_context.client.post(
        "/api/addresses",
        headers=_headers(address_context),
        json=payload,
    )

    assert response.status_code == 422


@pytest.mark.parametrize(
    "path,method,payload",
    [
        ("/api/addresses/{id}", "get", None),
        ("/api/addresses/{id}", "patch", {"city": "Pune"}),
        ("/api/addresses/{id}", "delete", None),
        ("/api/addresses/{id}/default", "patch", None),
    ],
)
def test_other_customers_cannot_access_an_address(
    address_context: AddressTestContext,
    path: str,
    method: str,
    payload: dict | None,
):
    address = _create_address(address_context)
    request_options = {
        "headers": _headers(address_context, other_customer=True),
    }
    if payload is not None:
        request_options["json"] = payload
    response = getattr(address_context.client, method)(
        path.format(id=address["id"]), **request_options
    )

    assert response.status_code == 404


def test_missing_address_returns_not_found(address_context: AddressTestContext):
    response = address_context.client.get(
        f"/api/addresses/{uuid4()}",
        headers=_headers(address_context),
    )

    assert response.status_code == 404


def test_deleting_default_promotes_oldest_remaining_address(
    address_context: AddressTestContext,
):
    default_address = _create_address(address_context, is_default=True)
    second = _create_address(address_context, label="Older remaining")
    third = _create_address(address_context, label="Newer remaining")
    with address_context.session_factory() as db:
        db.get(Address, UUID(default_address["id"])).created_at = datetime(
            2025, 1, 3, tzinfo=UTC
        )
        db.get(Address, UUID(second["id"])).created_at = datetime(
            2025, 1, 1, tzinfo=UTC
        )
        db.get(Address, UUID(third["id"])).created_at = datetime(
            2025, 1, 2, tzinfo=UTC
        )
        db.commit()

    response = address_context.client.delete(
        f"/api/addresses/{default_address['id']}",
        headers=_headers(address_context),
    )
    remaining = address_context.client.get(
        "/api/addresses",
        headers=_headers(address_context),
    ).json()

    assert response.status_code == 204
    assert [item["id"] for item in remaining] == [second["id"], third["id"]]
    assert [item["is_default"] for item in remaining] == [True, False]


def test_order_referenced_address_cannot_be_deleted(
    address_context: AddressTestContext,
):
    address = _create_address(address_context, is_default=True)
    with address_context.session_factory() as db:
        db.add(
            Order(
                customer_id=address_context.customer_id,
                address_id=UUID(address["id"]),
                order_number="ADDRESS-ORDER-1",
                total_amount=Decimal("10.00"),
                status="placed",
                payment_status="simulated",
                payment_method="simulated",
            )
        )
        db.commit()

    response = address_context.client.delete(
        f"/api/addresses/{address['id']}",
        headers=_headers(address_context),
    )

    assert response.status_code == 409
    assert address_context.client.get(
        f"/api/addresses/{address['id']}",
        headers=_headers(address_context),
    ).status_code == 200
