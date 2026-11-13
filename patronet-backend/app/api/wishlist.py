import logging
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.api.auth import get_current_customer
from app.db.database import get_db
from app.models.customer import Customer
from app.models.product import Product
from app.models.wishlist_item import WishlistItem
from app.schemas.wishlist import WishlistItemResponse, WishlistResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/wishlist", tags=["wishlist"])


def _load_wishlist(db: Session, customer_id: UUID) -> list[WishlistItem]:
    return list(
        db.scalars(
            select(WishlistItem)
            .where(WishlistItem.customer_id == customer_id)
            .options(
                selectinload(WishlistItem.product)
                .selectinload(Product.images),
                selectinload(WishlistItem.product)
                .selectinload(Product.category),
            )
            .order_by(WishlistItem.added_at.desc())
        ).all()
    )


def _item_response(item: WishlistItem) -> WishlistItemResponse:
    from app.schemas.product import ProductDetail
    return WishlistItemResponse(
        id=item.id,
        product=ProductDetail.model_validate(item.product),
        added_at=item.added_at,
    )


@router.get("", response_model=WishlistResponse)
def get_wishlist(
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> WishlistResponse:
    try:
        items = _load_wishlist(db, customer.id)
        return WishlistResponse(
            items=[_item_response(i) for i in items],
            total=len(items),
        )
    except SQLAlchemyError as err:
        logger.warning("Wishlist query failed (table may not be migrated yet): %s", err)
        db.rollback()
        return WishlistResponse(items=[], total=0)


@router.post("/{product_id}", response_model=WishlistItemResponse, status_code=status.HTTP_201_CREATED)
def add_to_wishlist(
    product_id: UUID,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> WishlistItemResponse:
    try:
        product = db.scalar(
            select(Product)
            .where(Product.id == product_id)
            .options(selectinload(Product.images), selectinload(Product.category))
        )
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found.")

        existing = db.scalar(
            select(WishlistItem).where(
                WishlistItem.customer_id == customer.id,
                WishlistItem.product_id == product_id,
            )
        )
        if existing is not None:
            return _item_response(existing)

        item = WishlistItem(customer_id=customer.id, product_id=product_id)
        db.add(item)
        db.commit()
        db.refresh(item)
        # reload with relationships
        item = db.scalar(
            select(WishlistItem)
            .where(WishlistItem.id == item.id)
            .options(
                selectinload(WishlistItem.product).selectinload(Product.images),
                selectinload(WishlistItem.product).selectinload(Product.category),
            )
        )
        return _item_response(item)
    except HTTPException:
        raise
    except SQLAlchemyError as err:
        logger.warning("Wishlist add failed (table may not be migrated yet): %s", err)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Wishlist service is currently unavailable.",
        ) from err


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_wishlist(
    product_id: UUID,
    customer: Customer = Depends(get_current_customer),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
) -> Response:
    try:
        item = db.scalar(
            select(WishlistItem).where(
                WishlistItem.customer_id == customer.id,
                WishlistItem.product_id == product_id,
            )
        )
        if item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist item not found.")
        db.delete(item)
        db.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except SQLAlchemyError as err:
        logger.warning("Wishlist remove failed (table may not be migrated yet): %s", err)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Wishlist service is currently unavailable.",
        ) from err
