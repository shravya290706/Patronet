from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.core.security import verify_password
from app.db.base import Base
from app.db.database import get_db
from app.main import app
from app.models.customer import Customer

_TEST_JWT_SECRET = "test-only-signing-secret-with-at-least-32-bytes"


@pytest.fixture
def auth_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[Customer.__table__])
    test_session = sessionmaker(bind=engine, class_=Session)

    def override_get_db() -> Iterator[Session]:
        with test_session() as db:
            yield db

    monkeypatch.setattr(settings, "JWT_SECRET_KEY", _TEST_JWT_SECRET)
    monkeypatch.setattr(settings, "JWT_ACCESS_TOKEN_EXPIRE_MINUTES", 30)
    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app, raise_server_exceptions=True)
    finally:
        app.dependency_overrides.pop(get_db, None)
        engine.dispose()


def _register(client: TestClient, email: str = "customer@example.com") -> dict:
    response = client.post(
        "/api/auth/register",
        json={
            "name": "Patronet Customer",
            "email": email,
            "password": "secure-password-123",
            "phone": "9876543210",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_register_creates_customer_with_hashed_password(auth_client: TestClient):
    response = auth_client.post(
        "/api/auth/register",
        json={
            "name": "Patronet Customer",
            "email": "CUSTOMER@example.com",
            "password": "secure-password-123",
        },
    )

    assert response.status_code == 201
    assert response.json()["email"] == "customer@example.com"
    assert "password_hash" not in response.json()
    test_db = app.dependency_overrides[get_db]()
    db = next(test_db)
    try:
        customer = db.scalar(
            select(Customer).where(Customer.email == "customer@example.com")
        )
        assert customer is not None
        assert customer.password_hash != "secure-password-123"
        assert verify_password("secure-password-123", customer.password_hash)
    finally:
        test_db.close()


def test_register_rejects_duplicate_email_case_insensitively(
    auth_client: TestClient,
):
    _register(auth_client)

    response = auth_client.post(
        "/api/auth/register",
        json={
            "name": "Another Customer",
            "email": "CUSTOMER@example.com",
            "password": "another-secure-password",
        },
    )

    assert response.status_code == 409


def test_register_rejects_invalid_email(auth_client: TestClient):
    response = auth_client.post(
        "/api/auth/register",
        json={"name": "Customer", "email": "not-an-email", "password": "password123"},
    )

    assert response.status_code == 422


def test_login_returns_signed_bearer_token(auth_client: TestClient):
    _register(auth_client)

    response = auth_client.post(
        "/api/auth/login",
        json={"email": "customer@example.com", "password": "secure-password-123"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 1800
    assert body["access_token"]


def test_login_rejects_incorrect_password(auth_client: TestClient):
    _register(auth_client)

    response = auth_client.post(
        "/api/auth/login",
        json={"email": "customer@example.com", "password": "incorrect-password"},
    )

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_me_rejects_invalid_token(auth_client: TestClient):
    response = auth_client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer invalid.token.value"},
    )

    assert response.status_code == 401


def test_me_returns_safe_profile_for_authenticated_customer(auth_client: TestClient):
    registered = _register(auth_client)
    login = auth_client.post(
        "/api/auth/login",
        json={"email": "customer@example.com", "password": "secure-password-123"},
    )
    token = login.json()["access_token"]

    response = auth_client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["id"] == registered["id"]
    assert response.json()["email"] == registered["email"]
    assert response.json()["name"] == registered["name"]
    assert "password_hash" not in response.json()
