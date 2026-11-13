from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db.database import get_db
from app.models.customer import Customer
from app.schemas.auth import (
    AccessTokenResponse,
    CustomerLogin,
    CustomerProfile,
    CustomerRegister,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])
_bearer_scheme = HTTPBearer(auto_error=False)


def _unauthorized() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password.",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _customer_by_email(db: Session, email: str) -> Customer | None:
    return db.scalar(
        select(Customer).where(func.lower(Customer.email) == email.lower())
    )


@router.post(
    "/register",
    response_model=CustomerProfile,
    status_code=status.HTTP_201_CREATED,
)
def register_customer(
    payload: CustomerRegister,
    db: Session = Depends(get_db),  # noqa: B008
) -> CustomerProfile:
    email = str(payload.email).strip().lower()
    if _customer_by_email(db, email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    customer = Customer(
        name=payload.name,
        email=email,
        password_hash=hash_password(payload.password),
        phone=payload.phone,
    )
    db.add(customer)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        if _customer_by_email(db, email) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists.",
            ) from error
        raise

    db.refresh(customer)
    return CustomerProfile.model_validate(customer)


@router.post("/login", response_model=AccessTokenResponse)
def login_customer(
    payload: CustomerLogin,
    db: Session = Depends(get_db),  # noqa: B008
) -> AccessTokenResponse:
    customer = _customer_by_email(db, str(payload.email).strip().lower())
    if customer is None or not verify_password(
        payload.password, customer.password_hash
    ):
        raise _unauthorized()

    expires_in = settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60
    if expires_in <= 0:
        raise RuntimeError("JWT_ACCESS_TOKEN_EXPIRE_MINUTES must be positive.")
    expires_at = datetime.now(UTC) + timedelta(seconds=expires_in)
    token = create_access_token(str(customer.id), int(expires_at.timestamp()))
    return AccessTokenResponse(access_token=token, expires_in=expires_in)


def get_current_customer(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Customer:
    if credentials is None:
        raise _unauthorized()

    try:
        claims = decode_access_token(credentials.credentials)
        subject = claims.get("sub")
        if not isinstance(subject, str):
            raise TypeError("Token subject must be a UUID string.")
        customer_id = UUID(subject)
    except (jwt.InvalidTokenError, ValueError, TypeError) as error:
        raise _unauthorized() from error

    customer = db.get(Customer, customer_id)
    if customer is None:
        raise _unauthorized()
    return customer


@router.get("/me", response_model=CustomerProfile)
def get_customer_profile(
    customer: Customer = Depends(get_current_customer),  # noqa: B008
) -> CustomerProfile:
    return CustomerProfile.model_validate(customer)
