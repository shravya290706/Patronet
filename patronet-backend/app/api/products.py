import logging
from decimal import Decimal
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from opensearchpy import OpenSearch
from opensearchpy.exceptions import NotFoundError
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.db.database import get_db
from app.models.category import Category
from app.models.product import Product
from app.models.product_image import ProductImage
from app.schemas.product import (
    CategoryOut,
    PaginatedProducts,
    ProductDetail,
    ProductSearchResponse,
    ProductSearchResult,
    ProductSummary,
)
from app.services.opensearch_client import get_opensearch_client
from app.services.product_search import (
    MAX_RESULT_WINDOW,
    SearchSort,
)
from app.services.product_search import (
    search_products as run_product_search,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["products"])


def _sorted_images(product: Product) -> list:
    return sorted(product.images, key=lambda img: img.display_order)


def _primary_image(product: Product) -> ProductImage | None:
    images = _sorted_images(product)
    for img in images:
        if img.is_primary:
            return img
    return images[0] if images else None


@router.get("/products", response_model=PaginatedProducts)
def list_products(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Results per page"),
    category_id: UUID | None = Query(None, description="Filter by category UUID"),  # noqa: B008
    brand: str | None = Query(None, description="Filter by brand name (case-insensitive)"),
    min_price: float | None = Query(None, ge=0, description="Minimum price"),
    max_price: float | None = Query(None, ge=0, description="Maximum price"),
    sort: Literal["price_asc", "price_desc", "newest"] = Query("newest", description="Sort order"),
    db: Session = Depends(get_db),  # noqa: B008
):
    base_query = (
        select(Product)
        .where(Product.is_active.is_(True))
        .options(
            selectinload(Product.category),
            selectinload(Product.images),
        )
    )

    if max_price is not None and min_price is not None and max_price < min_price:
        raise HTTPException(status_code=422, detail="max_price must be >= min_price")

    if category_id is not None:
        base_query = base_query.where(Product.category_id == category_id)
    if brand is not None:
        base_query = base_query.where(func.lower(Product.brand) == brand.lower())
    if min_price is not None:
        base_query = base_query.where(Product.price >= min_price)
    if max_price is not None:
        base_query = base_query.where(Product.price <= max_price)

    count_query = select(func.count()).select_from(base_query.subquery())
    total = db.execute(count_query).scalar_one()

    sort_col = {
        "price_asc": Product.price.asc(),
        "price_desc": Product.price.desc(),
        "newest": Product.created_at.desc(),
    }[sort]

    rows = db.execute(
        base_query.order_by(sort_col).offset((page - 1) * page_size).limit(page_size)
    ).scalars().all()

    results = []
    for p in rows:
        p.images = _sorted_images(p)
        summary = ProductSummary.model_validate(p)
        summary.primary_image = _primary_image(p)
        results.append(summary)

    return PaginatedProducts(total=total, page=page, page_size=page_size, results=results)


@router.get("/products/search", response_model=ProductSearchResponse)
def search_products_endpoint(
    q: str | None = Query(None, max_length=200, description="Typo-tolerant search text"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Results per page"),
    category_id: UUID | None = Query(None, description="Filter by category UUID"),  # noqa: B008
    brand: str | None = Query(None, max_length=100, description="Case-insensitive brand filter"),
    min_price: Decimal | None = Query(None, ge=0, description="Minimum price"),  # noqa: B008
    max_price: Decimal | None = Query(None, ge=0, description="Maximum price"),  # noqa: B008
    city: str | None = Query(None, max_length=100, description="Only products in stock in this city"),
    sort: SearchSort = Query("relevance", description="Search relevance, price, or newest order"),  # noqa: B008
    client: OpenSearch | None = Depends(get_opensearch_client),  # noqa: B008
    db: Session = Depends(get_db),  # noqa: B008
):
    if min_price is not None and max_price is not None and max_price < min_price:
        raise HTTPException(status_code=422, detail="max_price must be >= min_price")
    if (page - 1) * page_size + page_size > MAX_RESULT_WINDOW:
        raise HTTPException(
            status_code=422,
            detail=f"Requested page exceeds the search result window of {MAX_RESULT_WINDOW}",
        )

    try:
        if client is None:
            raise ConnectionError("OpenSearch is not configured")
        return run_product_search(
            client,
            query=q,
            page=page,
            page_size=page_size,
            category_id=str(category_id) if category_id is not None else None,
            brand=brand,
            min_price=min_price,
            max_price=max_price,
            city=city,
            sort=sort,
        )
    except Exception as error:
        logger.warning(
            "OpenSearch product search failed or unconfigured (%s); using PostgreSQL fallback.",
            error,
        )
        base_query = (
            select(Product)
            .where(Product.is_active.is_(True))
            .options(
                selectinload(Product.category),
                selectinload(Product.images),
            )
        )
        if q and q.strip():
            terms = q.strip().split()
            for term in terms:
                pattern = f"%{term}%"
                base_query = base_query.where(
                    or_(
                        Product.name.ilike(pattern),
                        Product.brand.ilike(pattern),
                        Product.description.ilike(pattern),
                    )
                )
        if category_id is not None:
            base_query = base_query.where(Product.category_id == category_id)
        if brand is not None:
            base_query = base_query.where(func.lower(Product.brand) == brand.lower())
        if min_price is not None:
            base_query = base_query.where(Product.price >= min_price)
        if max_price is not None:
            base_query = base_query.where(Product.price <= max_price)

        total = db.scalar(select(func.count()).select_from(base_query.subquery())) or 0
        sort_col = Product.created_at.desc()
        if sort == "price_asc":
            sort_col = Product.price.asc()
        elif sort == "price_desc":
            sort_col = Product.price.desc()

        products = db.scalars(
            base_query.order_by(sort_col).offset((page - 1) * page_size).limit(page_size)
        ).all()

        results = []
        for p in products:
            p.images = _sorted_images(p)
            summary = ProductSummary.model_validate(p)
            summary.primary_image = _primary_image(p)
            results.append(
                ProductSearchResult(
                    id=summary.id,
                    name=summary.name,
                    description=p.description,
                    brand=summary.brand,
                    sku=summary.sku,
                    price=summary.price,
                    is_active=summary.is_active,
                    category=summary.category,
                    primary_image=summary.primary_image,
                    created_at=summary.created_at,
                    stores=[],
                )
            )

        return ProductSearchResponse(
            total=total,
            page=page,
            page_size=page_size,
            results=results,
        )


@router.get("/products/brands", response_model=list[str])
def list_product_brands(
    db: Session = Depends(get_db),  # noqa: B008
) -> list[str]:
    brands = db.execute(
        select(Product.brand)
        .where(
            Product.is_active.is_(True),
            Product.brand.is_not(None),
            func.trim(Product.brand) != "",
        )
        .distinct()
        .order_by(Product.brand)
    ).scalars().all()
    return sorted(brands, key=str.casefold)


@router.get("/products/{product_id}", response_model=ProductDetail)
def get_product(
    product_id: UUID,
    db: Session = Depends(get_db),  # noqa: B008
):
    row = db.execute(
        select(Product)
        .where(Product.id == product_id)
        .options(
            selectinload(Product.category),
            selectinload(Product.images),
        )
    ).scalar_one_or_none()

    if row is None:
        raise HTTPException(status_code=404, detail="Product not found")

    row.images = _sorted_images(row)
    return ProductDetail.model_validate(row)


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):  # noqa: B008
    rows = db.execute(select(Category).order_by(Category.name)).scalars().all()
    return [CategoryOut.model_validate(c) for c in rows]
