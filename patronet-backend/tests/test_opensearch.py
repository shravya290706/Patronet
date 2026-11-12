from app.services.opensearch_client import create_opensearch_client

client = create_opensearch_client()
index = "patronet_test_products"

if not client.indices.exists(index=index):
    client.indices.create(index=index)

client.index(
    index=index,
    id="test-product-001",
    body={
        "name": "Wireless Bluetooth Headphones",
        "category": "Electronics",
        "price": 2499,
        "city": "Bengaluru"
    },
    refresh=True,
)

result = client.search(
    index=index,
    body={
        "query": {
            "match": {
                "name": "Bluetooth Headphones"
            }
        }
    }
)

for hit in result["hits"]["hits"]:
    print(hit["_source"])