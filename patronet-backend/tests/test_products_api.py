"""
Product catalogue API tests.
Uses FastAPI dependency_overrides to inject a mock DB session.
No data is written to the shared Aiven database.
"""

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from sqlalchemy.sql import Select
from sqlalchemy.sql.functions import Function

from app.db.database import get_db
from app.main import app
from app.models.category import Category
from app.models.product import Product
from app.models.product_image import ProductImage

client = TestClient(app, raise_server_exceptions=True)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_category(name="Electronics"):
    c = MagicMock(spec=Category)
    c.id = uuid.uuid4()
    c.name = name
    c.description = None
    return c


def _make_image(product_id, is_primary=True, display_order=0):
    img = MagicMock(spec=ProductImage)
    img.id = uuid.uuid4()
    img.product_id = product_id
    img.image_url = "https://example.com/img.jpg"
    img.is_primary = is_primary
    img.display_order = display_order
    return img


def _make_product(name="Widget", price="999.00", brand="Acme", category=None, images=None):
    p = MagicMock(spec=Product)
    p.id = uuid.uuid4()
    p.name = name
    p.description = "A fine widget"
    p.brand = brand
    p.sku = f"SKU-{p.id}"
    p.price = Decimal(price)
    p.is_active = True
    p.category = category or _make_category()
    p.images = images if images is not None else [_make_image(p.id)]
    p.created_at = datetime(2025, 1, 1, tzinfo=UTC)
    p.updated_at = None
    return p


# Sentinel so callers can pass single_product=None to mean "not found"
_SENTINEL = object()


def _override_db(
    products=None,
    categories=None,
    brands=None,
    total=None,
    single_product=_SENTINEL,
):
    """
    Returns a get_db override function that yields a mock session.
    Handles the three query patterns used by the router:
      - count query  → scalar_one()          (Select wrapping func.count)
      - list query   → scalars().all()        (Select from products table)
      - single query → scalar_one_or_none()   (when single_product is set)
      - categories   → scalars().all()        (Select from categories table)
    Pass single_product=None explicitly to simulate a not-found result.
    """
    products = products or []
    categories = categories or []
    brands = brands or []
    use_single = single_product is not _SENTINEL

    def _is_count_query(stmt) -> bool:
        """True when the outermost SELECT contains func.count."""
        if not isinstance(stmt, Select):
            return False
        return any(
            isinstance(col.get("expr"), Function)
            and col["expr"].name == "count"
            for col in stmt.column_descriptions
        )

    def _is_categories_query(stmt) -> bool:
        """True when the SELECT targets the categories table."""
        if not isinstance(stmt, Select):
            return False
        froms = stmt.get_final_froms()
        return any(
            getattr(f, "name", "") == "categories"
            or getattr(getattr(f, "element", None), "name", "") == "categories"
            for f in froms
        )

    def _is_brands_query(stmt) -> bool:
        if not isinstance(stmt, Select) or len(stmt.column_descriptions) != 1:
            return False
        expression = stmt.column_descriptions[0].get("expr")
        return getattr(expression, "name", "") == "brand"

    def _get_db_override():
        db = MagicMock()

        def execute_side_effect(stmt, *args, **kwargs):
            result = MagicMock()

            if _is_count_query(stmt):
                result.scalar_one.return_value = (
                    total if total is not None else len(products)
                )
            elif _is_brands_query(stmt):
                result.scalars.return_value.all.return_value = brands
            elif use_single:
                result.scalar_one_or_none.return_value = single_product
            elif _is_categories_query(stmt):
                result.scalars.return_value.all.return_value = categories
            else:
                result.scalars.return_value.all.return_value = products

            return result

        db.execute.side_effect = execute_side_effect
        yield db

    return _get_db_override


# ---------------------------------------------------------------------------
# GET /api/products — listing
# ---------------------------------------------------------------------------

class TestListProducts:
    def test_returns_paginated_response(self):
        products = [_make_product(f"Product {i}") for i in range(3)]
        app.dependency_overrides[get_db] = _override_db(products=products, total=3)

        resp = client.get("/api/products")
        app.dependency_overrides.clear()

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 3
        assert body["page"] == 1
        assert body["page_size"] == 20
        assert len(body["results"]) == 3
        print("PASS: list products returns paginated response")

    def test_result_fields_present(self):
        p = _make_product()
        app.dependency_overrides[get_db] = _override_db(products=[p], total=1)

        resp = client.get("/api/products")
        app.dependency_overrides.clear()

        assert resp.status_code == 200
        item = resp.json()["results"][0]
        for field in ("id", "name", "brand", "sku", "price", "is_active", "category"):
            assert field in item, f"Missing field: {field}"
        assert "password_hash" not in item
        print("PASS: result fields present, no sensitive data")

    def test_primary_image_included(self):
        p = _make_product()
        app.dependency_overrides[get_db] = _override_db(products=[p], total=1)

        resp = client.get("/api/products")
        app.dependency_overrides.clear()

        item = resp.json()["results"][0]
        assert item["primary_image"] is not None
        assert "image_url" in item["primary_image"]
        print("PASS: primary image included in listing")

    def test_no_primary_image_falls_back_to_first(self):
        p = _make_product()
        p.images = [_make_image(p.id, is_primary=False)]
        app.dependency_overrides[get_db] = _override_db(products=[p], total=1)

        resp = client.get("/api/products")
        app.dependency_overrides.clear()

        item = resp.json()["results"][0]
        assert item["primary_image"] is not None
        print("PASS: falls back to first image when no primary set")

    def test_no_images_returns_null_primary(self):
        p = _make_product(images=[])
        app.dependency_overrides[get_db] = _override_db(products=[p], total=1)

        resp = client.get("/api/products")
        app.dependency_overrides.clear()

        item = resp.json()["results"][0]
        assert item["primary_image"] is None
        print("PASS: null primary_image when product has no images")

    def test_empty_catalogue(self):
        app.dependency_overrides[get_db] = _override_db(products=[], total=0)

        resp = client.get("/api/products")
        app.dependency_overrides.clear()

        body = resp.json()
        assert body["total"] == 0
        assert body["results"] == []
        print("PASS: empty catalogue returns zero results")

    def test_pagination_params_reflected(self):
        products = [_make_product(f"P{i}") for i in range(5)]
        app.dependency_overrides[get_db] = _override_db(products=products, total=50)

        resp = client.get("/api/products?page=3&page_size=5")
        app.dependency_overrides.clear()

        body = resp.json()
        assert body["page"] == 3
        assert body["page_size"] == 5
        assert body["total"] == 50
        print("PASS: pagination params reflected in response")

    def test_invalid_page_rejected(self):
        resp = client.get("/api/products?page=0")
        assert resp.status_code == 422
        print("PASS: page=0 rejected with 422")

    def test_page_size_over_limit_rejected(self):
        resp = client.get("/api/products?page_size=101")
        assert resp.status_code == 422
        print("PASS: page_size=101 rejected with 422")

    def test_inactive_products_excluded(self):
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        tables = [Category.__table__, Product.__table__, ProductImage.__table__]
        Category.metadata.create_all(engine, tables=tables)

        try:
            with Session(engine) as db:
                category = Category(name="Test category")
                db.add(category)
                db.flush()
                db.add_all(
                    [
                        Product(
                            category_id=category.id,
                            name="Active Product",
                            sku="SKU-ACTIVE",
                            price=Decimal("10.00"),
                            is_active=True,
                        ),
                        Product(
                            category_id=category.id,
                            name="Inactive Product",
                            sku="SKU-INACTIVE",
                            price=Decimal("10.00"),
                            is_active=False,
                        ),
                    ]
                )
                db.commit()

                def override_db():
                    yield db

                app.dependency_overrides[get_db] = override_db
                resp = client.get("/api/products")
        finally:
            app.dependency_overrides.pop(get_db, None)
            engine.dispose()

        assert resp.status_code == 200
        body = resp.json()
        assert body["total"] == 1
        assert [item["name"] for item in body["results"]] == ["Active Product"]
        print("PASS: inactive products excluded from listing")


# ---------------------------------------------------------------------------
# GET /api/products — filtering
# ---------------------------------------------------------------------------

class TestProductFilters:
    def test_category_filter_accepted(self):
        app.dependency_overrides[get_db] = _override_db(products=[], total=0)
        resp = client.get(f"/api/products?category_id={uuid.uuid4()}")
        app.dependency_overrides.clear()
        assert resp.status_code == 200
        print("PASS: category_id filter accepted")

    def test_brand_filter_accepted(self):
        app.dependency_overrides[get_db] = _override_db(products=[], total=0)
        resp = client.get("/api/products?brand=Acme")
        app.dependency_overrides.clear()
        assert resp.status_code == 200
        print("PASS: brand filter accepted")

    def test_price_range_accepted(self):
        app.dependency_overrides[get_db] = _override_db(products=[], total=0)
        resp = client.get("/api/products?min_price=100&max_price=500")
        app.dependency_overrides.clear()
        assert resp.status_code == 200
        print("PASS: price range filter accepted")

    def test_inverted_price_range_rejected(self):
        app.dependency_overrides[get_db] = _override_db(products=[], total=0)
        resp = client.get("/api/products?min_price=500&max_price=100")
        app.dependency_overrides.clear()
        assert resp.status_code == 422
        print("PASS: inverted price range rejected with 422")

    def test_negative_min_price_rejected(self):
        resp = client.get("/api/products?min_price=-1")
        assert resp.status_code == 422
        print("PASS: negative min_price rejected with 422")


# ---------------------------------------------------------------------------
# GET /api/products — sorting
# ---------------------------------------------------------------------------

class TestProductSorting:
    @pytest.mark.parametrize("sort_val", ["price_asc", "price_desc", "newest"])
    def test_valid_sort_values(self, sort_val):
        app.dependency_overrides[get_db] = _override_db(products=[], total=0)
        resp = client.get(f"/api/products?sort={sort_val}")
        app.dependency_overrides.clear()
        assert resp.status_code == 200
        print(f"PASS: sort={sort_val} accepted")

    def test_invalid_sort_rejected(self):
        resp = client.get("/api/products?sort=random")
        assert resp.status_code == 422
        print("PASS: invalid sort value rejected with 422")


# ---------------------------------------------------------------------------
# GET /api/products/{id} — product detail
# ---------------------------------------------------------------------------

class TestProductDetail:
    def test_returns_full_detail(self):
        p = _make_product()
        p.images = [
            _make_image(p.id, is_primary=False, display_order=2),
            _make_image(p.id, is_primary=True, display_order=0),
        ]
        app.dependency_overrides[get_db] = _override_db(single_product=p)

        resp = client.get(f"/api/products/{p.id}")
        app.dependency_overrides.clear()

        assert resp.status_code == 200
        body = resp.json()
        assert body["id"] == str(p.id)
        assert body["name"] == p.name
        assert "description" in body
        assert "images" in body
        assert len(body["images"]) == 2
        assert [image["display_order"] for image in body["images"]] == [0, 2]
        assert "category" in body
        print("PASS: product detail returns full data with all images")

    def test_404_for_unknown_id(self):
        app.dependency_overrides[get_db] = _override_db(single_product=None)

        resp = client.get(f"/api/products/{uuid.uuid4()}")
        app.dependency_overrides.clear()

        assert resp.status_code == 404
        assert resp.json()["detail"] == "Product not found"
        print("PASS: 404 returned for unknown product id")

    def test_invalid_uuid_rejected(self):
        resp = client.get("/api/products/not-a-uuid")
        assert resp.status_code == 422
        print("PASS: non-UUID product_id rejected with 422")

    def test_no_sensitive_fields_exposed(self):
        p = _make_product()
        app.dependency_overrides[get_db] = _override_db(single_product=p)

        resp = client.get(f"/api/products/{p.id}")
        app.dependency_overrides.clear()

        body = resp.json()
        assert "password_hash" not in body
        assert "category_id" not in body
        print("PASS: no sensitive fields in product detail response")


# ---------------------------------------------------------------------------
# GET /api/categories
# ---------------------------------------------------------------------------

class TestCategories:
    def test_returns_list(self):
        cats = [_make_category("Electronics"), _make_category("Clothing")]
        app.dependency_overrides[get_db] = _override_db(categories=cats)

        resp = client.get("/api/categories")
        app.dependency_overrides.clear()

        assert resp.status_code == 200
        body = resp.json()
        assert isinstance(body, list)
        assert len(body) == 2
        print("PASS: categories returns list")

    def test_category_fields(self):
        cats = [_make_category("Books")]
        app.dependency_overrides[get_db] = _override_db(categories=cats)

        resp = client.get("/api/categories")
        app.dependency_overrides.clear()

        item = resp.json()[0]
        assert "id" in item
        assert "name" in item
        assert item["name"] == "Books"
        print("PASS: category fields correct")

    def test_empty_categories(self):
        app.dependency_overrides[get_db] = _override_db(categories=[])

        resp = client.get("/api/categories")
        app.dependency_overrides.clear()

        assert resp.status_code == 200
        assert resp.json() == []
        print("PASS: empty categories returns empty list")


class TestProductBrands:
    def test_returns_sorted_brand_names(self):
        app.dependency_overrides[get_db] = _override_db(
            brands=["boAt", "Acme"]
        )

        resp = client.get("/api/products/brands")
        app.dependency_overrides.clear()

        assert resp.status_code == 200
        assert resp.json() == ["Acme", "boAt"]

    def test_brand_endpoint_is_matched_before_product_uuid_route(self):
        app.dependency_overrides[get_db] = _override_db(brands=["Acme"])

        resp = client.get("/api/products/brands")
        app.dependency_overrides.clear()

        assert resp.status_code == 200
        assert resp.json() == ["Acme"]


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    t = TestListProducts()
    t.test_returns_paginated_response()
    t.test_result_fields_present()
    t.test_primary_image_included()
    t.test_no_primary_image_falls_back_to_first()
    t.test_no_images_returns_null_primary()
    t.test_empty_catalogue()
    t.test_pagination_params_reflected()
    t.test_invalid_page_rejected()
    t.test_page_size_over_limit_rejected()
    t.test_inactive_products_excluded()

    f = TestProductFilters()
    f.test_category_filter_accepted()
    f.test_brand_filter_accepted()
    f.test_price_range_accepted()
    f.test_inverted_price_range_rejected()
    f.test_negative_min_price_rejected()

    s = TestProductSorting()
    for v in ["price_asc", "price_desc", "newest"]:
        s.test_valid_sort_values(v)
    s.test_invalid_sort_rejected()

    d = TestProductDetail()
    d.test_returns_full_detail()
    d.test_404_for_unknown_id()
    d.test_invalid_uuid_rejected()
    d.test_no_sensitive_fields_exposed()

    c = TestCategories()
    c.test_returns_list()
    c.test_category_fields()
    c.test_empty_categories()

    print("\nAll product API tests passed.")
