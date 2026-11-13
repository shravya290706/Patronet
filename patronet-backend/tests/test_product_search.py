from datetime import UTC, datetime
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.main import app
from app.models import Category, Inventory, Product, ProductImage, Store
from app.services.opensearch_client import get_opensearch_client
from app.services.product_search import (
    PRODUCT_INDEX_ALIAS,
    PRODUCT_INDEX_DEFINITION,
    build_product_document,
    build_search_body,
    rebuild_product_index,
)

client = TestClient(app, raise_server_exceptions=True)


@pytest.fixture
def sqlite_session():
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
        tables=[
            Category.__table__,
            Product.__table__,
            ProductImage.__table__,
            Store.__table__,
            Inventory.__table__,
        ],
    )
    with Session(engine) as session:
        yield session
    engine.dispose()


def _add_product(session: Session, sku: str, *, is_active: bool = True) -> Product:
    category = Category(name=f"Category {sku}", description="Test category")
    store = Store(
        name=f"Store {sku}",
        city="Bengaluru",
        state="Karnataka",
        pincode="560001",
        address="1 Test Road",
        is_active=True,
    )
    product = Product(
        category=category,
        name="Wireless Headphones",
        description="Over-ear wireless audio device",
        specifications={},
        brand="Acme",
        sku=sku,
        price=Decimal("2499.00"),
        is_active=is_active,
        created_at=datetime(2025, 1, 1, tzinfo=UTC),
    )
    session.add_all([category, store, product])
    session.flush()
    session.add_all(
        [
            ProductImage(
                product=product,
                image_url="https://example.test/secondary.png",
                is_primary=False,
                display_order=0,
            ),
            ProductImage(
                product=product,
                image_url="https://example.test/primary.png",
                is_primary=True,
                display_order=1,
            ),
            Inventory(
                product=product,
                store=store,
                available_stock=5,
            ),
        ]
    )
    session.flush()
    return product


def test_index_definition_covers_search_filters_and_store_availability():
    properties = PRODUCT_INDEX_DEFINITION["mappings"]["properties"]

    assert properties["name"]["type"] == "text"
    assert properties["description"]["type"] == "text"
    assert properties["brand"]["fields"]["keyword"]["type"] == "keyword"
    assert properties["sku"]["type"] == "keyword"
    assert properties["category_id"]["type"] == "keyword"
    assert properties["price"] == {"type": "scaled_float", "scaling_factor": 100}
    assert properties["stores"]["type"] == "nested"
    assert properties["stores"]["properties"]["city"]["type"] == "keyword"


def test_product_document_uses_loaded_postgres_relationship_data(sqlite_session):
    product = _add_product(sqlite_session, "SKU-SEARCH-1")

    document = build_product_document(product)

    assert document["product_id"] == str(product.id)
    assert document["category"]["name"] == "Category SKU-SEARCH-1"
    assert document["price"] == 2499.0
    assert document["primary_image"]["image_url"] == "https://example.test/primary.png"
    assert document["stores"] == [
        {
            "id": str(product.inventory[0].store.id),
            "name": "Store SKU-SEARCH-1",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560001",
            "address": "1 Test Road",
            "is_active": True,
            "available_stock": 5,
        }
    ]


def test_search_body_has_fuzzy_query_and_all_filters():
    category_id = str(uuid4())
    body = build_search_body(
        query="wireles headfones",
        page=2,
        page_size=10,
        category_id=category_id,
        brand=" Acme ",
        min_price=Decimal("1000.00"),
        max_price=Decimal("3000.00"),
        city=" Bengaluru ",
        sort="price_desc",
    )

    assert body["from"] == 10
    assert body["size"] == 10
    bool_query = body["query"]["bool"]
    fuzzy_query = bool_query["must"][0]["multi_match"]
    assert fuzzy_query["query"] == "wireles headfones"
    assert fuzzy_query["fuzziness"] == "AUTO"
    assert {"term": {"is_active": True}} in bool_query["filter"]
    assert {"term": {"category_id": category_id}} in bool_query["filter"]
    assert {"term": {"brand.keyword": "acme"}} in bool_query["filter"]
    assert {"range": {"price": {"gte": 1000.0, "lte": 3000.0}}} in bool_query["filter"]
    city_filter = next(item["nested"] for item in bool_query["filter"] if "nested" in item)
    assert city_filter["path"] == "stores"
    assert body["sort"] == [{"price": "desc"}, {"product_id": "asc"}]


def test_rebuild_indexes_database_products_and_swaps_alias_without_deleting_old_index(
    sqlite_session, monkeypatch
):
    active_product = _add_product(sqlite_session, "SKU-SEARCH-ACTIVE")
    inactive_product = _add_product(
        sqlite_session, "SKU-SEARCH-INACTIVE", is_active=False
    )
    open_search = MagicMock()
    open_search.indices.exists_alias.return_value = True
    open_search.indices.get_alias.return_value = {
        "patronet_products_v20261113000000_old": {}
    }
    indexed_actions = []

    def capture_bulk(_client, actions, **_kwargs):
        indexed_actions.extend(actions)

    monkeypatch.setattr("app.services.product_search.helpers.bulk", capture_bulk)

    indexed_count = rebuild_product_index(sqlite_session, open_search)

    assert indexed_count == 2
    create_call = open_search.indices.create.call_args
    new_index = create_call.kwargs["index"]
    assert new_index.startswith(f"{PRODUCT_INDEX_ALIAS}_v")
    assert create_call.kwargs["body"] == PRODUCT_INDEX_DEFINITION
    assert {action["_id"] for action in indexed_actions} == {
        str(active_product.id),
        str(inactive_product.id),
    }
    alias_actions = open_search.indices.update_aliases.call_args.kwargs["body"]["actions"]
    assert alias_actions[0] == {
        "remove": {
            "index": "patronet_products_v20261113000000_old",
            "alias": PRODUCT_INDEX_ALIAS,
        }
    }
    assert alias_actions[1] == {
        "add": {"index": new_index, "alias": PRODUCT_INDEX_ALIAS}
    }
    open_search.indices.delete.assert_not_called()


def test_search_endpoint_returns_results_and_passes_filters():
    product_id = uuid4()
    category_id = uuid4()
    image_id = uuid4()
    store_id = uuid4()
    open_search = MagicMock()
    open_search.search.return_value = {
        "hits": {
            "total": {"value": 1, "relation": "eq"},
            "hits": [
                {
                    "_source": {
                        "product_id": str(product_id),
                        "name": "Wireless Headphones",
                        "description": "Over-ear wireless audio device",
                        "brand": "Acme",
                        "sku": "SKU-SEARCH-1",
                        "price": 2499.0,
                        "is_active": True,
                        "created_at": "2025-01-01T00:00:00+00:00",
                        "category_id": str(category_id),
                        "category": {
                            "id": str(category_id),
                            "name": "Electronics",
                            "description": None,
                        },
                        "primary_image": {
                            "id": str(image_id),
                            "image_url": "https://example.test/primary.png",
                            "is_primary": True,
                            "display_order": 0,
                        },
                        "stores": [
                            {
                                "id": str(store_id),
                                "name": "Bengaluru Store",
                                "city": "Bengaluru",
                                "state": "Karnataka",
                                "pincode": "560001",
                                "address": "1 Test Road",
                                "is_active": True,
                                "available_stock": 5,
                            }
                        ],
                    }
                }
            ],
        }
    }
    app.dependency_overrides[get_opensearch_client] = lambda: open_search
    try:
        response = client.get(
            "/api/products/search",
            params={
                "q": "wireles headfones",
                "category_id": str(category_id),
                "brand": "Acme",
                "min_price": "1000",
                "max_price": "3000",
                "city": "Bengaluru",
                "page": 2,
                "page_size": 5,
                "sort": "price_asc",
            },
        )
    finally:
        app.dependency_overrides.pop(get_opensearch_client, None)

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["page"] == 2
    assert body["page_size"] == 5
    assert body["results"][0]["id"] == str(product_id)
    assert body["results"][0]["stores"][0]["city"] == "Bengaluru"
    search_body = open_search.search.call_args.kwargs["body"]
    assert search_body["from"] == 5
    assert search_body["sort"] == [{"price": "asc"}, {"product_id": "asc"}]


@pytest.mark.parametrize(
    ("params", "expected_detail"),
    [
        (
            {"min_price": "300", "max_price": "100"},
            "max_price must be >= min_price",
        ),
        (
            {"page": 101, "page_size": 100},
            "Requested page exceeds the search result window of 10000",
        ),
    ],
)
def test_search_endpoint_rejects_invalid_range_and_result_window(
    params, expected_detail
):
    open_search = MagicMock()
    app.dependency_overrides[get_opensearch_client] = lambda: open_search
    try:
        response = client.get("/api/products/search", params=params)
    finally:
        app.dependency_overrides.pop(get_opensearch_client, None)

    assert response.status_code == 422
    assert response.json()["detail"] == expected_detail
    open_search.search.assert_not_called()
