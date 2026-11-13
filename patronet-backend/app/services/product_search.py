from collections.abc import Sequence
from datetime import UTC, datetime
from decimal import Decimal
import re
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



_WORD_SPLIT_RE = re.compile(r"[^a-z0-9]+")

QUERY_SYNONYMS: dict[str, tuple[str, ...]] = {
    "fridge": ("refrigerator",),
    "frige": ("refrigerator",),
    "fridges": ("refrigerator",),
    "phone": ("smartphone", "mobile"),
    "phones": ("smartphone", "mobile"),
    "mobile": ("smartphone", "mobile"),
    "mobiles": ("smartphone", "mobile"),
    "cellphone": ("smartphone",),
    "pants": ("trousers", "jeans", "pants", "leggings"),
    "pant": ("trousers", "jeans", "pants", "leggings"),
    "tee": ("tshirt", "shirt"),
    "tees": ("tshirt", "shirt"),
    "tshirt": ("tshirt", "shirt"),
    "tshirts": ("tshirt", "shirt"),
    "luggage": ("suitcase", "bag", "duffel", "backpack"),
    "bag": ("bag", "suitcase", "duffel", "backpack", "pouch", "wallet"),
    "bags": ("bag", "suitcase", "duffel", "backpack", "pouch", "wallet"),
    "purse": ("wallet", "pouch"),
    "atta": ("wheat", "flour"),
    "daal": ("dal",),
    "lentil": ("dal",),
    "lentils": ("dal",),
    "facewash": ("face", "cleanser", "wash"),
    "moisturizer": ("moisturiser",),
    "moisturizers": ("moisturiser",),
    "soap": ("wash", "cleanser"),
    "lego": ("lego", "bricks"),
    "kindle": ("ereader", "reader"),
    "powerbank": ("powerbank", "power", "bank"),
    "bedsheet": ("bedsheet", "linen"),
    "bedsheets": ("bedsheet", "linen"),
}


def _tokenize_search_text(text: str | None, *, include_bigrams: bool = False) -> list[str]:
    if not text:
        return []
    cleaned = text.lower().replace("'", "").replace("\u2019", "")
    words = [w for w in _WORD_SPLIT_RE.split(cleaned) if w]
    if not include_bigrams or len(words) < 2:
        return words
    bigrams = [f"{words[i]}{words[i + 1]}" for i in range(len(words) - 1)]
    return words + bigrams


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
        tokens = _tokenize_search_text(normalized_query)
        extra_synonyms: list[str] = []
        for t in tokens:
            if t in QUERY_SYNONYMS:
                for syn in QUERY_SYNONYMS[t]:
                    if syn not in tokens and syn not in extra_synonyms:
                        extra_synonyms.append(syn)

        search_query_str = (
            f"{normalized_query} {' '.join(extra_synonyms)}"
            if extra_synonyms
            else normalized_query
        )

        bool_query["must"] = [
            {
                "multi_match": {
                    "query": search_query_str,
                    "fields": [
                        "name^4",
                        "brand^2",
                        "category.name^3",
                        "sku.search^3",
                        "description",
                    ],
                    "fuzziness": "AUTO",
                    "prefix_length": 0,
                    "max_expansions": 50,
                    "operator": "or",
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



def _damerau_levenshtein(s1: str, s2: str) -> int:
    if s1 == s2:
        return 0
    len1, len2 = len(s1), len(s2)
    if len1 == 0:
        return len2
    if len2 == 0:
        return len1
    if abs(len1 - len2) > 4:
        return abs(len1 - len2)

    d = [[0] * (len2 + 1) for _ in range(len1 + 1)]
    for i in range(len1 + 1):
        d[i][0] = i
    for j in range(len2 + 1):
        d[0][j] = j

    for i in range(1, len1 + 1):
        for j in range(1, len2 + 1):
            cost = 0 if s1[i - 1] == s2[j - 1] else 1
            d[i][j] = min(
                d[i - 1][j] + 1,
                d[i][j - 1] + 1,
                d[i - 1][j - 1] + cost,
            )
            if (
                i > 1
                and j > 1
                and s1[i - 1] == s2[j - 2]
                and s1[i - 2] == s2[j - 1]
            ):
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
    return d[len1][len2]


def _token_similarity(
    query_token: str,
    candidate_words: Sequence[str],
    *,
    allow_fuzzy: bool = True,
) -> float:
    if not query_token or not candidate_words:
        return 0.0

    best = 0.0
    q_len = len(query_token)
    variants = (query_token, *QUERY_SYNONYMS.get(query_token, ()))

    for qt in variants:
        qt_len = len(qt)
        is_synonym = qt != query_token
        weight_Penalty = 0.92 if is_synonym else 1.0

        for cw in candidate_words:
            cw_len = len(cw)
            if qt == cw:
                return 1.0 * weight_Penalty
            if qt_len >= 2 and cw.startswith(qt):
                best = max(best, 0.94 * weight_Penalty)
                continue
            if qt_len >= 3 and qt in cw:
                best = max(best, 0.88 * weight_Penalty)
                continue
            if cw_len >= 4 and cw in qt and (qt_len - cw_len) <= 2:
                best = max(best, 0.85 * weight_Penalty)
                continue

            if not allow_fuzzy:
                continue

            if qt_len == 3 and cw_len == 3 and sorted(qt) == sorted(cw):
                best = max(best, 0.80 * weight_Penalty)
                continue

            if qt_len >= 4 and cw_len >= 3:
                if qt_len == 4:
                    max_dist = 1
                elif qt_len <= 7:
                    max_dist = 2
                else:
                    max_dist = 3

                if abs(qt_len - cw_len) <= max_dist:
                    dist = _damerau_levenshtein(qt, cw)
                    if dist <= max_dist:
                        if qt_len == 4 and qt[0] != cw[0] and sorted(qt) != sorted(cw):
                            continue
                        ratio = 1.0 - (dist / max(qt_len, cw_len))
                        if ratio >= 0.64:
                            best = max(best, ratio * weight_Penalty)
                            continue

                if qt_len >= 5 and cw_len > qt_len + 1:
                    prefix_max = 1 if qt_len <= 6 else 2
                    p_dist = min(
                        _damerau_levenshtein(qt, cw[:qt_len]),
                        _damerau_levenshtein(qt, cw[: qt_len + 1]),
                    )
                    if p_dist <= prefix_max:
                        best = max(best, 0.72 * weight_Penalty)

    return best


def fuzzy_score_product(product: Product, query: str) -> float:
    """Compute a typo-tolerant relevance score for a product against a search query."""
    query_tokens = _tokenize_search_text(query, include_bigrams=False)
    if not query_tokens:
        return 1.0

    name_words = _tokenize_search_text(product.name, include_bigrams=True)
    category_words = _tokenize_search_text(
        product.category.name if product.category else None,
        include_bigrams=True,
    )
    brand_words = _tokenize_search_text(product.brand, include_bigrams=True)
    sku_words = _tokenize_search_text(product.sku, include_bigrams=False)
    desc_words = [
        w
        for w in _tokenize_search_text(product.description, include_bigrams=False)
        if len(w) >= 4
        and w
        not in {
            "synthetic",
            "listing",
            "fictional",
            "patronet",
            "comparison",
            "record",
            "generated",
            "demonstration",
            "commercial",
            "illustrative",
        }
    ]

    total_score = 0.0
    matched_tokens = 0

    for qt in query_tokens:
        name_sim = _token_similarity(qt, name_words, allow_fuzzy=True)
        cat_sim = _token_similarity(qt, category_words, allow_fuzzy=True)
        brand_sim = _token_similarity(qt, brand_words, allow_fuzzy=True)
        sku_sim = _token_similarity(qt, sku_words, allow_fuzzy=False)
        desc_sim = _token_similarity(qt, desc_words, allow_fuzzy=len(qt) >= 5)

        token_best = max(
            name_sim * 4.0,
            cat_sim * 3.0,
            brand_sim * 2.5,
            sku_sim * 2.0,
            desc_sim * 1.0,
        )
        best_raw_sim = max(name_sim, cat_sim, brand_sim, sku_sim, desc_sim)

        if best_raw_sim >= 0.64:
            matched_tokens += 1
            total_score += token_best

    if matched_tokens == 0:
        return 0.0

    required_matches = len(query_tokens) if len(query_tokens) <= 2 else max(2, len(query_tokens) - 1)
    if matched_tokens < required_matches:
        return 0.0

    if matched_tokens == len(query_tokens) and len(query_tokens) > 1:
        total_score *= 1.25

    return round(total_score, 4)

