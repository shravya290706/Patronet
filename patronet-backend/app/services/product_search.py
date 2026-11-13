from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, Literal
from uuid import UUID, uuid4

from opensearchpy import OpenSearch, helpers
from opensearchpy.exceptions import OpenSearchException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models.inventory import Inventory
from app.models.product import Product
from app.models.store import Store

PRODUCT_INDEX_ALIAS = "patronet_products"
MAX_RESULT_WINDOW = 10_000
SearchSort = Literal["relevance", "price_asc", "price_desc", "newest"]

PRODUCT_INDEX_DEFINITION: dict[str, Any] = {
    "settings": {
        "analysis": {
            "normalizer": {
                "lowercase_normalizer": {
                    "type": "custom",
                    "filter": ["lowercase"],
                }
            }
        }
    },
    "mappings": {
        "properties": {
            "product_id": {"type": "keyword"},
            "name": {
                "type": "text",
                "fields": {
                    "keyword": {
                        "type": "keyword",
                        "normalizer": "lowercase_normalizer",
                    }
                },
            },
            "description": {"type": "text"},
            "brand": {
                "type": "text",
                "fields": {
                    "keyword": {
                        "type": "keyword",
                        "normalizer": "lowercase_normalizer",
                    }
                },
            },
            "sku": {
                "type": "keyword",
                "fields": {"search": {"type": "text"}},
            },
            "category_id": {"type": "keyword"},
            "category": {
                "properties": {
                    "id": {"type": "keyword"},
                    "name": {
                        "type": "text",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "normalizer": "lowercase_normalizer",
                            }
                        },
                    },
                    "description": {"type": "text"},
                }
            },
            "price": {"type": "scaled_float", "scaling_factor": 100},
            "is_active": {"type": "boolean"},
            "created_at": {"type": "date"},
            "primary_image": {
                "properties": {
                    "id": {"type": "keyword"},
                    "image_url": {"type": "keyword", "index": False},
                    "is_primary": {"type": "boolean"},
                    "display_order": {"type": "integer"},
                }
            },
            "stores": {
                "type": "nested",
                "properties": {
                    "id": {"type": "keyword"},
                    "name": {
                        "type": "text",
                        "fields": {
                            "keyword": {
                                "type": "keyword",
                                "normalizer": "lowercase_normalizer",
                            }
                        },
                    },
                    "city": {
                        "type": "keyword",
                        "normalizer": "lowercase_normalizer",
                    },
                    "state": {
                        "type": "keyword",
                        "normalizer": "lowercase_normalizer",
                    },
                    "pincode": {"type": "keyword"},
                    "address": {"type": "text", "index": False},
                    "is_active": {"type": "boolean"},
                    "available_stock": {"type": "integer"},
                },
            },
        }
    },
}


def _new_index_name() -> str:
    timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S%f")
    return f"{PRODUCT_INDEX_ALIAS}_v{timestamp}_{uuid4().hex[:8]}"


def _primary_image(product: Product) -> dict[str, Any] | None:
    images = sorted(product.images, key=lambda image: image.display_order)
    image = next((item for item in images if item.is_primary), images[0] if images else None)
    if image is None:
        return None
    return {
        "id": str(image.id),
        "image_url": image.image_url,
        "is_primary": image.is_primary,
        "display_order": image.display_order,
    }


def build_product_document(product: Product) -> dict[str, Any]:
    stores = []
    for inventory in sorted(
        product.inventory,
        key=lambda item: (
            item.store.city.casefold() if item.store is not None else "",
            str(item.store_id),
        ),
    ):
        store: Store | None = inventory.store
        if store is None:
            continue
        stores.append(
            {
                "id": str(store.id),
                "name": store.name,
                "city": store.city,
                "state": store.state,
                "pincode": store.pincode,
                "address": store.address,
                "is_active": store.is_active,
                "available_stock": inventory.available_stock,
            }
        )

    return {
        "product_id": str(product.id),
        "name": product.name,
        "description": product.description,
        "brand": product.brand,
        "sku": product.sku,
        "category_id": str(product.category_id),
        "category": {
            "id": str(product.category.id),
            "name": product.category.name,
            "description": product.category.description,
        },
        "price": float(product.price),
        "is_active": product.is_active,
        "created_at": product.created_at.isoformat(),
        "primary_image": _primary_image(product),
        "stores": stores,
    }


def _products_for_index(
    session: Session,
    product_ids: set[UUID] | None = None,
) -> list[Product]:
    statement = select(Product).options(
        selectinload(Product.category),
        selectinload(Product.images),
        selectinload(Product.inventory).selectinload(Inventory.store),
    )
    if product_ids is not None:
        statement = statement.where(Product.id.in_(product_ids))
    statement = statement.order_by(Product.id)
    return list(session.scalars(statement).all())


def rebuild_product_index(session: Session, client: OpenSearch) -> int:
    products = _products_for_index(session)
    index_name = _new_index_name()
    client.indices.create(index=index_name, body=PRODUCT_INDEX_DEFINITION)

    actions = [
        {
            "_op_type": "index",
            "_index": index_name,
            "_id": str(product.id),
            "_source": build_product_document(product),
        }
        for product in products
    ]
    if actions:
        helpers.bulk(client, actions, refresh=True, raise_on_error=True)

    existing_aliases = (
        client.indices.get_alias(name=PRODUCT_INDEX_ALIAS)
        if client.indices.exists_alias(name=PRODUCT_INDEX_ALIAS)
        else {}
    )
    alias_actions = [
        {"remove": {"index": old_index, "alias": PRODUCT_INDEX_ALIAS}}
        for old_index in existing_aliases
    ]
    alias_actions.append(
        {"add": {"index": index_name, "alias": PRODUCT_INDEX_ALIAS}}
    )
    client.indices.update_aliases(body={"actions": alias_actions})
    return len(products)


def sync_products_to_search(
    session: Session,
    client: OpenSearch,
    product_ids: set[UUID],
) -> int:
    if not product_ids:
        return 0
    if not client.indices.exists_alias(name=PRODUCT_INDEX_ALIAS):
        raise OpenSearchException(
            "Product search alias is not initialized; rebuild the index first."
        )

    products = _products_for_index(session, product_ids)
    if len(products) != len(product_ids):
        raise ValueError("An order event references a product missing from PostgreSQL.")

    actions = [
        {
            "_op_type": "index",
            "_index": PRODUCT_INDEX_ALIAS,
            "_id": str(product.id),
            "_source": build_product_document(product),
        }
        for product in products
    ]
    helpers.bulk(client, actions, refresh="wait_for", raise_on_error=True)
    return len(products)


def build_search_body(
    *,
    query: str | None,
    page: int,
    page_size: int,
    category_id: str | None = None,
    brand: str | None = None,
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    city: str | None = None,
    sort: SearchSort = "relevance",
) -> dict[str, Any]:
    bool_query: dict[str, Any] = {}
    filters: list[dict[str, Any]] = [{"term": {"is_active": True}}]
    normalized_query = query.strip() if query else ""

    if normalized_query:
        bool_query["must"] = [
            {
                "multi_match": {
                    "query": normalized_query,
                    "fields": ["name^4", "brand^2", "sku.search^3", "description"],
                    "fuzziness": "AUTO",
                    "prefix_length": 1,
                    "max_expansions": 50,
                }
            }
        ]
    if category_id:
        filters.append({"term": {"category_id": category_id}})
    if brand and brand.strip():
        filters.append({"term": {"brand.keyword": brand.strip().lower()}})
    if min_price is not None or max_price is not None:
        price_range: dict[str, float] = {}
        if min_price is not None:
            price_range["gte"] = float(min_price)
        if max_price is not None:
            price_range["lte"] = float(max_price)
        filters.append({"range": {"price": price_range}})
    if city and city.strip():
        filters.append(
            {
                "nested": {
                    "path": "stores",
                    "query": {
                        "bool": {
                            "filter": [
                                {"term": {"stores.city": city.strip().lower()}},
                                {"term": {"stores.is_active": True}},
                                {"range": {"stores.available_stock": {"gt": 0}}},
                            ]
                        }
                    },
                }
            }
        )
    if filters:
        bool_query["filter"] = filters

    sort_fields: dict[SearchSort, list[dict[str, Any]]] = {
        "relevance": [{"_score": "desc"}, {"product_id": "asc"}],
        "price_asc": [{"price": "asc"}, {"product_id": "asc"}],
        "price_desc": [{"price": "desc"}, {"product_id": "asc"}],
        "newest": [{"created_at": "desc"}, {"product_id": "asc"}],
    }
    query_clause = {"bool": bool_query} if bool_query else {"match_all": {}}
    return {
        "from": (page - 1) * page_size,
        "size": page_size,
        "query": query_clause,
        "sort": sort_fields[sort],
    }


def search_products(
    client: OpenSearch,
    *,
    query: str | None,
    page: int,
    page_size: int,
    category_id: str | None = None,
    brand: str | None = None,
    min_price: Decimal | None = None,
    max_price: Decimal | None = None,
    city: str | None = None,
    sort: SearchSort = "relevance",
) -> dict[str, Any]:
    body = build_search_body(
        query=query,
        page=page,
        page_size=page_size,
        category_id=category_id,
        brand=brand,
        min_price=min_price,
        max_price=max_price,
        city=city,
        sort=sort,
    )
    response = client.search(index=PRODUCT_INDEX_ALIAS, body=body)
    hits = response["hits"]
    total_hits = hits["total"]
    total = total_hits["value"] if isinstance(total_hits, dict) else total_hits
    results = []
    for hit in hits["hits"]:
        result = dict(hit["_source"])
        result["id"] = result.pop("product_id")
        results.append(result)
    return {"total": total, "page": page, "page_size": page_size, "results": results}
