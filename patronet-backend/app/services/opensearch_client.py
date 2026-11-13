
from collections.abc import Iterator

from opensearchpy import OpenSearch

from app.core.config import settings


def create_opensearch_client():
    return OpenSearch(
        hosts=[
            {
                "host": settings.OPENSEARCH_HOST,
                "port": settings.OPENSEARCH_PORT,
            }
        ],
        http_auth=(
            settings.OPENSEARCH_USERNAME,
            settings.OPENSEARCH_PASSWORD,
        ),
        use_ssl=settings.OPENSEARCH_USE_SSL,
        verify_certs=True,
    )


def get_opensearch_client() -> Iterator[OpenSearch | None]:
    if not settings.OPENSEARCH_HOST or not settings.OPENSEARCH_HOST.strip():
        yield None
        return
    client = create_opensearch_client()
    try:
        yield client
    finally:
        client.close()


def test_opensearch_connection():
    client = create_opensearch_client()

    if not client.ping():
        raise ConnectionError("Could not connect to Aiven OpenSearch")

    return client.info()
