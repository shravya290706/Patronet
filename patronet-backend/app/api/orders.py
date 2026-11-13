from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.api.auth import get_current_customer
from app.db.database import get_db
from app.models.address import Address
from app.models.cart import Cart
from app.models.cart_item import CartItem
from app.models.customer import Customer
from app.models.inventory import Inventory
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.outbox_event import OutboxEvent
from app.models.product import Product
from app.models.store import Store
from app.schemas.orders import (
    CheckoutRequest,
    OrderAddressSnapshot,
    OrderEventItem,
    OrderEventPayload,
    OrderItemResponse,
    OrderResponse,
    PaginatedOrders,
)

router = APIRouter(prefix="/api/orders", tags=["orders"])

_EVENT_TYPE = "order.placed"
_PAGE_SIZE_MAX = 100


def _lock_customer(db: Session, customer_id: UUID) -> None:
    db.execute(
        select(Customer.id).where(Customer.id == customer_id).with_for_update()
    ).scalar_one()


def _address_snapshot(address: Address) -> OrderAddressSnapshot:
    return OrderAddressSnapshot(
        full_name=address.full_name,
        phone=address.phone,
        address_line=address.address_line,
        city=address.city,
        state=address.state,
        pincode=address.pincode,
    )


def _order_response(order: Order) -> OrderResponse:
    item_responses = [
        OrderItemResponse(
            id=item.id,
            product_id=item.product_id,
            store_id=item.store_id,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.subtotal,
        )
        for item in sorted(
            order.items,
            key=lambda item: (str(item.product_id), str(item.store_id)),
        )
    ]
    subtotal = sum(
        (item.subtotal for item in item_responses),
        start=Decimal("0.00"),
    )
    return OrderResponse(
        id=order.id,
        order_number=order.order_number,
        status=order.status,
        payment_status=order.payment_status,
        payment_method=order.payment_method,
        address_id=order.address_id,
        delivery_address=OrderAddressSnapshot(
            full_name=order.snapshot_full_name,
            phone=order.snapshot_phone,
            address_line=order.snapshot_address_line,
            city=order.snapshot_city,
            state=order.snapshot_state,
            pincode=order.snapshot_pincode,
        ),
        items=item_responses,
        subtotal=subtotal,
        total_amount=order.total_amount,
        created_at=order.created_at,
    )


def _checkout_error(detail: str, code: int = status.HTTP_409_CONFLICT) -> HTTPException:
    return HTTPException(status_code=code, detail=detail)


def _create_order_event(
    db: Session,
    order: Order,
    address: OrderAddressSnapshot,
    items: list[OrderEventItem],
    subtotal: Decimal,
) -> None:
    payload = OrderEventPayload(
        order_id=order.id,
        customer_id=order.customer_id,
        order_number=order.order_number,
        event_type=_EVENT_TYPE,
        status=order.status,
        payment_status=order.payment_status,
        payment_method=order.payment_method or "simulated",
        subtotal=subtotal,
        total_amount=order.total_amount,
        delivery_address=address,
        items=items,
    )
    db.add(
        OutboxEvent(
            event_id=uuid4(),
            aggregate_type="order",
            aggregate_id=order.id,
            event_type=_EVENT_TYPE,
            payload=payload.model_dump(mode="json"),
            status="pending",
        )
    )


def _checkout(
    db: Session,
    customer: Customer,
    payload: CheckoutRequest,
) -> OrderResponse:
    with db.begin_nested():
        _lock_customer(db, customer.id)

        address = db.scalar(
            select(Address)
            .where(
                Address.id == payload.address_id,
                Address.customer_id == customer.id,
            )
            .with_for_update()
        )
        if address is None:
            raise _checkout_error(
                "Shipping address not found for this customer.",
                status.HTTP_404_NOT_FOUND,
            )

        cart = db.scalar(
            select(Cart)
            .where(
                Cart.customer_id == customer.id,
                Cart.status == "active",
            )
            .with_for_update()
        )
        if cart is None:
            raise _checkout_error("The cart is empty.")

        cart_items = db.scalars(
            select(CartItem)
            .where(CartItem.cart_id == cart.id)
            .order_by(CartItem.product_id)
            .with_for_update()
        ).all()
        if not cart_items:
            raise _checkout_error("The cart is empty.")

        product_ids = sorted({item.product_id for item in cart_items}, key=str)
        products = db.scalars(
            select(Product)
            .where(Product.id.in_(product_ids))
            .order_by(Product.id)
            .with_for_update()
        ).all()
        products_by_id = {product.id: product for product in products}
        if len(products_by_id) != len(product_ids):
            raise _checkout_error("A cart product is no longer available.")
        if any(not product.is_active for product in products):
            raise _checkout_error("A cart product is no longer available.")

        inventory_rows = db.scalars(
            select(Inventory)
            .join(Store, Store.id == Inventory.store_id)
            .where(
                Inventory.product_id.in_(product_ids),
                Store.is_active.is_(True),
            )
            .order_by(Inventory.product_id, Inventory.store_id)
            .with_for_update(of=Inventory)
        ).all()
        inventory_by_product: dict[UUID, list[Inventory]] = {
            product_id: [] for product_id in product_ids
        }
        for inventory in inventory_rows:
            inventory_by_product[inventory.product_id].append(inventory)

        for cart_item in cart_items:
            available = sum(
                row.available_stock
                for row in inventory_by_product[cart_item.product_id]
            )
            if available < cart_item.quantity:
                raise _checkout_error(
                    "Insufficient stock for one or more cart products."
                )

        subtotal = sum(
            (
                Decimal(products_by_id[item.product_id].price) * item.quantity
                for item in cart_items
            ),
            start=Decimal("0.00"),
        )
        address_snapshot = _address_snapshot(address)
        order = Order(
            customer_id=customer.id,
            address_id=address.id,
            order_number=f"PAT-{uuid4().hex.upper()}",
            total_amount=subtotal,
            status="placed",
            payment_status="simulated",
            payment_method="simulated",
            snapshot_full_name=address_snapshot.full_name,
            snapshot_phone=address_snapshot.phone,
            snapshot_address_line=address_snapshot.address_line,
            snapshot_city=address_snapshot.city,
            snapshot_state=address_snapshot.state,
            snapshot_pincode=address_snapshot.pincode,
            created_at=datetime.now(UTC),
        )
        db.add(order)
        db.flush()

        event_items = []
        for cart_item in cart_items:
            product = products_by_id[cart_item.product_id]
            remaining = cart_item.quantity
            unit_price = Decimal(product.price)
            for inventory in inventory_by_product[cart_item.product_id]:
                allocated_quantity = min(inventory.available_stock, remaining)
                if allocated_quantity <= 0:
                    continue
                line_subtotal = unit_price * allocated_quantity
                inventory.available_stock -= allocated_quantity
                db.add(
                    OrderItem(
                        order_id=order.id,
                        product_id=product.id,
                        store_id=inventory.store_id,
                        quantity=allocated_quantity,
                        unit_price=unit_price,
                        subtotal=line_subtotal,
                    )
                )
                event_items.append(
                    OrderEventItem(
                        product_id=product.id,
                        product_name=product.name,
                        sku=product.sku,
                        store_id=inventory.store_id,
                        quantity=allocated_quantity,
                        unit_price=unit_price,
                        subtotal=line_subtotal,
                    )
                )
                remaining -= allocated_quantity
                if remaining == 0:
                    break

        db.flush()
        order.items = db.scalars(
            select(OrderItem)
            .where(OrderItem.order_id == order.id)
            .order_by(OrderItem.product_id, OrderItem.store_id)
        ).all()
        _create_order_event(db, order, address_snapshot, event_items, subtotal)
        db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))
        db.flush()
        response = _order_response(order)

    db.commit()
    return response


@router.post(
    "/checkout",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def checkout(
    payload: CheckoutRequest,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> OrderResponse:
    return _checkout(db, customer, payload)


@router.get("", response_model=PaginatedOrders)
def list_orders(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=_PAGE_SIZE_MAX),
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> PaginatedOrders:
    filters = Order.customer_id == customer.id
    total = db.scalar(select(func.count(Order.id)).where(filters)) or 0
    orders = db.scalars(
        select(Order)
        .where(filters)
        .options(selectinload(Order.items))
        .order_by(Order.created_at.desc(), Order.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return PaginatedOrders(
        total=total,
        page=page,
        page_size=page_size,
        results=[_order_response(order) for order in orders],
    )


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: UUID,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> OrderResponse:
    order = db.scalar(
        select(Order)
        .where(
            Order.id == order_id,
            Order.customer_id == customer.id,
        )
        .options(selectinload(Order.items))
    )
    if order is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found.",
        )
    return _order_response(order)
