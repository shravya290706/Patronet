from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.auth import get_current_customer
from app.db.database import get_db
from app.models.address import Address
from app.models.customer import Customer
from app.models.order import Order
from app.schemas.addresses import AddressCreate, AddressResponse, AddressUpdate

router = APIRouter(prefix="/api/addresses", tags=["addresses"])


def _lock_customer(db: Session, customer_id: UUID) -> None:
    db.execute(
        select(Customer.id).where(Customer.id == customer_id).with_for_update()
    ).scalar_one()


def _owned_address(
    db: Session,
    address_id: UUID,
    customer_id: UUID,
    *,
    lock: bool = False,
) -> Address | None:
    statement = select(Address).where(
        Address.id == address_id,
        Address.customer_id == customer_id,
    )
    if lock:
        statement = statement.with_for_update()
    return db.scalar(statement)


def _address_response(address: Address) -> AddressResponse:
    return AddressResponse(
        id=address.id,
        full_name=address.full_name,
        phone=address.phone,
        address_line_1=address.address_line,
        address_line_2=address.address_line_2,
        city=address.city,
        state=address.state,
        pincode=address.pincode,
        country=address.country,
        label=address.label,
        is_default=address.is_default,
        created_at=address.created_at,
    )


def _address_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Address not found.",
    )


def _clear_defaults(db: Session, customer_id: UUID) -> None:
    db.execute(
        update(Address)
        .where(Address.customer_id == customer_id)
        .values(is_default=False)
    )


@router.post(
    "",
    response_model=AddressResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_address(
    payload: AddressCreate,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> AddressResponse:
    with db.begin_nested():
        _lock_customer(db, customer.id)
        if payload.is_default:
            _clear_defaults(db, customer.id)
        address = Address(
            customer_id=customer.id,
            full_name=payload.full_name,
            phone=payload.phone,
            address_line=payload.address_line_1,
            address_line_2=payload.address_line_2,
            city=payload.city,
            state=payload.state,
            pincode=payload.pincode,
            country=payload.country,
            label=payload.label,
            is_default=payload.is_default,
        )
        db.add(address)
        db.flush()
        response = _address_response(address)
    db.commit()
    return response


@router.get("", response_model=list[AddressResponse])
def list_addresses(
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> list[AddressResponse]:
    addresses = db.scalars(
        select(Address)
        .where(Address.customer_id == customer.id)
        .order_by(
            Address.is_default.desc(),
            Address.created_at.asc(),
            Address.id.asc(),
        )
    ).all()
    return [_address_response(address) for address in addresses]


@router.get("/{address_id}", response_model=AddressResponse)
def get_address(
    address_id: UUID,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> AddressResponse:
    address = _owned_address(db, address_id, customer.id)
    if address is None:
        raise _address_not_found()
    return _address_response(address)


@router.patch("/{address_id}", response_model=AddressResponse)
def update_address(
    address_id: UUID,
    payload: AddressUpdate,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> AddressResponse:
    with db.begin_nested():
        _lock_customer(db, customer.id)
        address = _owned_address(db, address_id, customer.id, lock=True)
        if address is None:
            raise _address_not_found()

        updates = payload.model_dump(exclude_unset=True)
        if updates.get("is_default") is True:
            _clear_defaults(db, customer.id)

        field_mapping = {
            "full_name": "full_name",
            "phone": "phone",
            "address_line_1": "address_line",
            "address_line_2": "address_line_2",
            "city": "city",
            "state": "state",
            "pincode": "pincode",
            "country": "country",
            "label": "label",
            "is_default": "is_default",
        }
        for request_field, model_field in field_mapping.items():
            if request_field in updates:
                setattr(address, model_field, updates[request_field])

        db.flush()
        response = _address_response(address)
    db.commit()
    return response


@router.delete("/{address_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_address(
    address_id: UUID,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Response:
    with db.begin_nested():
        _lock_customer(db, customer.id)
        address = _owned_address(db, address_id, customer.id, lock=True)
        if address is None:
            raise _address_not_found()

        order_exists = db.scalar(
            select(Order.id)
            .where(Order.address_id == address.id)
            .limit(1)
        )
        if order_exists is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Address is associated with an order and cannot be deleted.",
            )

        was_default = address.is_default
        db.delete(address)
        db.flush()
        if was_default:
            remaining = db.scalars(
                select(Address)
                .where(Address.customer_id == customer.id)
                .order_by(Address.created_at.asc(), Address.id.asc())
                .with_for_update()
            ).all()
            if remaining:
                _clear_defaults(db, customer.id)
                remaining[0].is_default = True
        db.flush()
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{address_id}/default", response_model=AddressResponse)
def set_default_address(
    address_id: UUID,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> AddressResponse:
    with db.begin_nested():
        _lock_customer(db, customer.id)
        address = _owned_address(db, address_id, customer.id, lock=True)
        if address is None:
            raise _address_not_found()
        _clear_defaults(db, customer.id)
        address.is_default = True
        db.flush()
        response = _address_response(address)
    db.commit()
    return response
