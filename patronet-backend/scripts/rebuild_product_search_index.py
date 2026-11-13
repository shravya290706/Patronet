"""Rebuild the OpenSearch product index from PostgreSQL.

Run from patronet-backend with ``python -m scripts.rebuild_product_search_index``.
The rebuild creates a versioned index and atomically switches the search alias.
Previous indices are retained; this command does not delete OpenSearch data.
"""

from app.db.database import SessionLocal
from app.services.opensearch_client import create_opensearch_client
from app.services.product_search import rebuild_product_index


def main() -> None:
    client = create_opensearch_client()
    try:
        with SessionLocal() as session:
            indexed_count = rebuild_product_index(session, client)
    finally:
        client.close()

    print(
        f"Rebuilt the product search index with {indexed_count} PostgreSQL products."
    )


if __name__ == "__main__":
    main()
