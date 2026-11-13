from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, selectinload

from app.api.auth import get_current_customer
from app.db.database import get_db
from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.customer import Customer
from app.models.inventory import Inventory
from app.models.product import Product
from app.models.store import Store
from app.schemas.cart import (
    CartItemCreate,
    CartItemResponse,
    CartItemUpdate,
    CartResponse,
)
from app.schemas.product import ProductDetail

router = APIRouter(prefix="/api/cart", tags=["cart"])


def _lock_customer(db: Session, customer_id: UUID) -> None:
    db.execute(
        select(Customer.id).where(Customer.id == customer_id).with_for_update()
    ).scalar_one()


def _active_cart_query(customer_id: UUID):
    return select(Cart).where(
        Cart.customer_id == customer_id,
        Cart.status == "active",
    )


def _load_cart(db: Session, customer_id: UUID) -> Cart | None:
    return db.scalar(
        _active_cart_query(customer_id).options(
            selectinload(Cart.items)
            .selectinload(CartItem.product)
            .selectinload(Product.images),
            selectinload(Cart.items)
            .selectinload(CartItem.product)
            .selectinload(Product.category),
        )
    )


def _cart_response(cart: Cart | None) -> CartResponse:
    if cart is None:
        return CartResponse(
            id=None,
            items=[],
            total_quantity=0,
            subtotal=Decimal("0.00"),
        )

    items = []
    for cart_item in sorted(cart.items, key=lambda item: (item.added_at, str(item.id))):
        unit_price = Decimal(cart_item.product.price)
        items.append(
            CartItemResponse(
                id=cart_item.id,
                product=ProductDetail.model_validate(cart_item.product),
                quantity=cart_item.quantity,
                unit_price=unit_price,
                subtotal=unit_price * cart_item.quantity,
            )
        )

    return CartResponse(
        id=cart.id,
        items=items,
        total_quantity=sum(item.quantity for item in items),
        subtotal=sum((item.subtotal for item in items), start=Decimal("0.00")),
    )


def _lock_active_cart(db: Session, customer_id: UUID) -> Cart | None:
    return db.scalar(_active_cart_query(customer_id).with_for_update())


def _get_active_product(db: Session, product_id: UUID) -> Product:
    product = db.scalar(
        select(Product)
        .where(Product.id == product_id)
        .options(selectinload(Product.images), selectinload(Product.category))
        .with_for_update()
    )
    if product is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found.",
        )
    if not product.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product is not available for purchase.",
        )
    return product


def _available_stock(db: Session, product_id: UUID) -> int:
    inventory_rows = db.scalars(
        select(Inventory)
        .join(Store, Store.id == Inventory.store_id)
        .where(
            Inventory.product_id == product_id,
            Store.is_active.is_(True),
        )
        .order_by(Inventory.store_id)
        .with_for_update(of=Inventory)
    ).all()
    return sum(row.available_stock for row in inventory_rows)


def _item_not_found() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Cart item not found.",
    )


def _insufficient_stock() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Requested quantity exceeds available stock.",
    )


@router.get("", response_model=CartResponse)
def get_cart(
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> CartResponse:
    return _cart_response(_load_cart(db, customer.id))


@router.post("/items", response_model=CartResponse)
def add_cart_item(
    payload: CartItemCreate,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> CartResponse:
    _lock_customer(db, customer.id)
    product = _get_active_product(db, payload.product_id)
    cart = _lock_active_cart(db, customer.id)

    existing_item = None
    if cart is not None:
        existing_item = db.scalar(
            select(CartItem)
            .where(
                CartItem.cart_id == cart.id,
                CartItem.product_id == product.id,
            )
            .with_for_update()
        )

    requested_quantity = payload.quantity + (
        existing_item.quantity if existing_item is not None else 0
    )
    if requested_quantity > _available_stock(db, product.id):
        raise _insufficient_stock()

    if cart is None:
        cart = Cart(customer_id=customer.id, status="active")
        db.add(cart)
        db.flush()

    if existing_item is None:
        db.add(
            CartItem(
                cart_id=cart.id,
                product_id=product.id,
                quantity=requested_quantity,
            )
        )
    else:
        existing_item.quantity = requested_quantity

    db.flush()
    response = _cart_response(_load_cart(db, customer.id))
    db.commit()
    return response


@router.patch("/items/{item_id}", response_model=CartResponse)
def update_cart_item(
    item_id: UUID,
    payload: CartItemUpdate,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> CartResponse:
    _lock_customer(db, customer.id)
    cart = _lock_active_cart(db, customer.id)
    if cart is None:
        raise _item_not_found()

    cart_item = db.scalar(
        select(CartItem)
        .where(CartItem.id == item_id, CartItem.cart_id == cart.id)
        .with_for_update()
    )
    if cart_item is None:
        raise _item_not_found()

    product = _get_active_product(db, cart_item.product_id)
    if payload.quantity > _available_stock(db, product.id):
        raise _insufficient_stock()

    cart_item.quantity = payload.quantity
    db.flush()
    response = _cart_response(_load_cart(db, customer.id))
    db.commit()
    return response


@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cart_item(
    item_id: UUID,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Response:
    _lock_customer(db, customer.id)
    cart = _lock_active_cart(db, customer.id)
    if cart is None:
        raise _item_not_found()

    cart_item = db.scalar(
        select(CartItem)
        .where(CartItem.id == item_id, CartItem.cart_id == cart.id)
        .with_for_update()
    )
    if cart_item is None:
        raise _item_not_found()

    db.delete(cart_item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_cart(
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Response:
    _lock_customer(db, customer.id)
    cart = _lock_active_cart(db, customer.id)
    if cart is not None:
        db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
