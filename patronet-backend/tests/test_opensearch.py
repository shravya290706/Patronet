import os

import pytest

RUN_AIVEN_INTEGRATION_TESTS = os.getenv("PATRONET_RUN_AIVEN_INTEGRATION_TESTS") == "1"
INDEX = "patronet_test_products"

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not RUN_AIVEN_INTEGRATION_TESTS,
        reason="Set PATRONET_RUN_AIVEN_INTEGRATION_TESTS=1 to run Aiven smoke tests",
    ),
]


def test_opensearch_smoke():
    from app.services.opensearch_client import create_opensearch_client

    client = create_opensearch_client()

    if not client.indices.exists(index=INDEX):
        client.indices.create(index=INDEX)

    client.index(
        index=INDEX,
        id="test-product-001",
        body={
            "name": "Wireless Bluetooth Headphones",
            "category": "Electronics",
            "price": 2499,
            "city": "Bengaluru",
        },
        refresh=True,
    )

    result = client.search(
        index=INDEX,
        body={"query": {"match": {"name": "Bluetooth Headphones"}}},
    )

    hits = result["hits"]["hits"]
    assert any(hit["_id"] == "test-product-001" for hit in hits)
    for hit in hits:
        print(hit["_source"])
