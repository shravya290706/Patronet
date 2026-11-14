from datetime import UTC, datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session, selectinload

from app.api.auth import get_current_customer
from app.core.config import settings
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
from app.schemas.payments import (
    CancelPaymentRequest,
    CancelPaymentResponse,
    InitiateCheckoutRequest,
    InitiateCheckoutResponse,
    VerifyPaymentRequest,
)
from app.services.gift_card_service import (
    redeem_gift_card,
    seed_demo_gift_cards,
    validate_gift_card,
)
from app.services.razorpay_service import (
    create_razorpay_order,
    get_payment_config,
    verify_razorpay_signature,
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
            order.items or [],
            key=lambda item: (str(item.product_id), str(item.store_id)),
        )
    ]
    subtotal = sum(
        (item.subtotal for item in item_responses),
        start=Decimal("0.00"),
    )
    if not item_responses and order.total_amount:
        subtotal = Decimal(str(order.total_amount))

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
        total_amount=Decimal(str(order.total_amount)),
        razorpay_order_id=order.razorpay_order_id,
        razorpay_payment_id=order.razorpay_payment_id,
        gift_card_code=order.gift_card_code,
        gift_card_amount=Decimal(str(order.gift_card_amount or "0.00")),
        payable_amount=Decimal(str(order.payable_amount)) if order.payable_amount is not None else None,
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
        total_amount=Decimal(str(order.total_amount)),
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
                Decimal(str(products_by_id[item.product_id].price)) * item.quantity
                for item in cart_items
            ),
            start=Decimal("0.00"),
        )
        gift_card_deduction = Decimal(str(payload.gift_card_amount or "0.00"))
        payable = max(Decimal("0.00"), subtotal - gift_card_deduction)
        payment_method = payload.payment_method or "simulated"
        payment_status = "simulated" if payload.payment_method is None else "paid"

        address_snapshot = _address_snapshot(address)
        order = Order(
            customer_id=customer.id,
            address_id=address.id,
            order_number=f"PAT-{uuid4().hex.upper()}",
            total_amount=subtotal,
            payable_amount=payable,
            gift_card_amount=gift_card_deduction,
            gift_card_code=payload.gift_card_code,
            status="placed",
            payment_status=payment_status,
            payment_method=payment_method,
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
            unit_price = Decimal(str(product.price))
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
    """Demo checkout endpoint that places orders with chosen payment method."""
    return _checkout(db, customer, payload)


@router.post(
    "/initiate",
    response_model=InitiateCheckoutResponse,
    status_code=status.HTTP_201_CREATED,
)
def initiate_checkout(
    payload: InitiateCheckoutRequest,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> InitiateCheckoutResponse:
    """Initiates checkout, calculates gift card deduction, and creates a pending order + Razorpay order."""
    seed_demo_gift_cards(db)

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
        if len(products_by_id) != len(product_ids) or any(not product.is_active for product in products):
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
                raise _checkout_error("Insufficient stock for one or more cart products.")

        subtotal = sum(
            (
                Decimal(str(products_by_id[item.product_id].price)) * item.quantity
                for item in cart_items
            ),
            start=Decimal("0.00"),
        )

        gift_card_amount = Decimal("0.00")
        applied_gift_card_code = None
        if payload.gift_card_code:
            card_res = validate_gift_card(db, payload.gift_card_code, subtotal)
            if not card_res["valid"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=card_res["message"],
                )
            gift_card_amount = card_res["applicable_amount"]
            applied_gift_card_code = card_res["code"]

        payable_amount = max(Decimal("0.00"), subtotal - gift_card_amount)
        address_snapshot = _address_snapshot(address)
        order_number = f"PAT-{uuid4().hex.upper()}"

        payment_cfg = get_payment_config()

        # If fully covered by gift card (payable_amount == 0), finalize immediately
        if payable_amount == Decimal("0.00"):
            order = Order(
                customer_id=customer.id,
                address_id=address.id,
                order_number=order_number,
                total_amount=subtotal,
                payable_amount=Decimal("0.00"),
                gift_card_code=applied_gift_card_code,
                gift_card_amount=gift_card_amount,
                status="placed",
                payment_status="paid",
                payment_method="gift_card",
                snapshot_full_name=address_snapshot.full_name,
                snapshot_phone=address_snapshot.phone,
                snapshot_address_line=address_snapshot.address_line,
                snapshot_city=address_snapshot.city,
                snapshot_state=address_snapshot.state,
                snapshot_pincode=address_snapshot.pincode,
                created_at=datetime.now(timezone.utc),
            )
            db.add(order)
            db.flush()

            # Deduct gift card balance
            redeem_gift_card(
                db=db,
                code=applied_gift_card_code,
                order_id=order.id,
                customer_id=customer.id,
                amount_to_deduct=gift_card_amount,
            )

            # Deduct stock and create items
            event_items = []
            for cart_item in cart_items:
                product = products_by_id[cart_item.product_id]
                remaining = cart_item.quantity
                unit_price = Decimal(str(product.price))
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

            response = InitiateCheckoutResponse(
                order_id=order.id,
                order_number=order.order_number,
                subtotal=subtotal,
                gift_card_code=applied_gift_card_code,
                gift_card_amount=gift_card_amount,
                payable_amount=Decimal("0.00"),
                razorpay_order_id=None,
                currency="INR",
                key_id=payment_cfg["razorpay_key_id"],
                mode=payment_cfg["mode"],
                status="placed",
            )
        else:
            # Create Razorpay order (Test or Mock Mode)
            rzp_order = create_razorpay_order(
                amount=payable_amount,
                receipt=order_number[:40],
                notes={"customer_id": str(customer.id)},
            )

            order = Order(
                customer_id=customer.id,
                address_id=address.id,
                order_number=order_number,
                total_amount=subtotal,
                payable_amount=payable_amount,
                gift_card_code=applied_gift_card_code,
                gift_card_amount=gift_card_amount,
                razorpay_order_id=rzp_order["id"],
                status="pending_payment",
                payment_status="pending",
                payment_method="razorpay",
                snapshot_full_name=address_snapshot.full_name,
                snapshot_phone=address_snapshot.phone,
                snapshot_address_line=address_snapshot.address_line,
                snapshot_city=address_snapshot.city,
                snapshot_state=address_snapshot.state,
                snapshot_pincode=address_snapshot.pincode,
                created_at=datetime.now(timezone.utc),
            )
            db.add(order)
            db.flush()

            # Snapshot order items without deducting inventory yet
            for cart_item in cart_items:
                product = products_by_id[cart_item.product_id]
                remaining = cart_item.quantity
                unit_price = Decimal(str(product.price))
                for inventory in inventory_by_product[cart_item.product_id]:
                    allocated_quantity = min(inventory.available_stock, remaining)
                    if allocated_quantity <= 0:
                        continue
                    line_subtotal = unit_price * allocated_quantity
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
                    remaining -= allocated_quantity
                    if remaining == 0:
                        break

            db.flush()

            response = InitiateCheckoutResponse(
                order_id=order.id,
                order_number=order.order_number,
                subtotal=subtotal,
                gift_card_code=applied_gift_card_code,
                gift_card_amount=gift_card_amount,
                payable_amount=payable_amount,
                razorpay_order_id=rzp_order["id"],
                currency="INR",
                key_id=payment_cfg["razorpay_key_id"],
                mode=payment_cfg["mode"],
                status="pending_payment",
            )

    db.commit()
    return response


@router.post("/verify-payment", response_model=OrderResponse)
def verify_payment(
    payload: VerifyPaymentRequest,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> OrderResponse:
    """Verifies Razorpay payment signature, deducts stock, deducts gift card balance, and clears cart."""
    with db.begin_nested():
        _lock_customer(db, customer.id)

        order = db.scalar(
            select(Order)
            .where(
                Order.id == payload.order_id,
                Order.customer_id == customer.id,
            )
            .options(selectinload(Order.items))
            .with_for_update()
        )
        if order is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found.",
            )

        # Idempotency check: already paid and placed
        if order.status == "placed" and order.payment_status == "paid":
            return _order_response(order)

        if order.status == "cancelled":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Order has been cancelled.",
            )

        # Verify signature
        is_valid = verify_razorpay_signature(
            razorpay_order_id=payload.razorpay_order_id,
            razorpay_payment_id=payload.razorpay_payment_id,
            razorpay_signature=payload.razorpay_signature,
        )
        if not is_valid:
            order.payment_status = "failed"
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment signature verification failed.",
            )

        # Re-verify and deduct inventory for allocated order items
        for item in order.items:
            inventory = db.scalar(
                select(Inventory)
                .where(
                    Inventory.product_id == item.product_id,
                    Inventory.store_id == item.store_id,
                )
                .with_for_update()
            )
            if not inventory or inventory.available_stock < item.quantity:
                order.payment_status = "refund_pending"
                order.status = "failed"
                raise _checkout_error(
                    "Insufficient stock for one or more items during payment processing.",
                )
            inventory.available_stock -= item.quantity

        # Deduct gift card if applicable
        if order.gift_card_code and order.gift_card_amount and Decimal(str(order.gift_card_amount)) > Decimal("0.00"):
            redeem_gift_card(
                db=db,
                code=order.gift_card_code,
                order_id=order.id,
                customer_id=customer.id,
                amount_to_deduct=Decimal(str(order.gift_card_amount)),
            )

        # Mark order placed and paid
        order.status = "placed"
        order.payment_status = "paid"
        order.payment_method = "razorpay"
        order.razorpay_order_id = payload.razorpay_order_id
        order.razorpay_payment_id = payload.razorpay_payment_id
        order.razorpay_signature = payload.razorpay_signature
        order.updated_at = datetime.now(timezone.utc)

        # Prepare outbox event
        address_snapshot = OrderAddressSnapshot(
            full_name=order.snapshot_full_name,
            phone=order.snapshot_phone,
            address_line=order.snapshot_address_line,
            city=order.snapshot_city,
            state=order.snapshot_state,
            pincode=order.snapshot_pincode,
        )
        prod_ids = [item.product_id for item in order.items]
        products = db.scalars(
            select(Product).where(Product.id.in_(prod_ids))
        ).all()
        prod_map = {p.id: p for p in products}

        event_items = [
            OrderEventItem(
                product_id=item.product_id,
                product_name=prod_map[item.product_id].name if item.product_id in prod_map else "Product",
                sku=prod_map[item.product_id].sku if item.product_id in prod_map else "SKU",
                store_id=item.store_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
                subtotal=item.subtotal,
            )
            for item in order.items
        ]
        _create_order_event(
            db, order, address_snapshot, event_items, Decimal(str(order.total_amount))
        )

        # Clear customer's active cart
        cart = db.scalar(
            select(Cart).where(Cart.customer_id == customer.id, Cart.status == "active")
        )
        if cart:
            db.execute(delete(CartItem).where(CartItem.cart_id == cart.id))

        db.flush()
        response = _order_response(order)

    db.commit()
    return response


@router.post("/cancel-payment", response_model=CancelPaymentResponse)
def cancel_payment(
    payload: CancelPaymentRequest,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> CancelPaymentResponse:
    """Cancels a pending payment attempt without altering inventory or cart."""
    with db.begin_nested():
        order = db.scalar(
            select(Order)
            .where(
                Order.id == payload.order_id,
                Order.customer_id == customer.id,
            )
            .with_for_update()
        )
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Order not found.",
            )
        if order.status == "placed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel an already completed order.",
            )
        order.status = "cancelled"
        order.payment_status = "cancelled"
        order.updated_at = datetime.now(timezone.utc)

    db.commit()
    return CancelPaymentResponse(
        order_id=order.id,
        status="cancelled",
        payment_status="cancelled",
        message="Payment cancelled. Cart and inventory remain untouched.",
    )


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
