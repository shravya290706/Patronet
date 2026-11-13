"""Run the Kafka order.placed consumer and OpenSearch inventory synchronizer."""

import logging

from app.core.config import settings
from app.db.database import SessionLocal
from app.services.kafka_consumer import (
    create_kafka_consumer,
    run_order_event_consumer,
)
from app.services.opensearch_client import create_opensearch_client


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    consumer = create_kafka_consumer()
    search_client = None
    try:
        search_client = create_opensearch_client()
        run_order_event_consumer(
            consumer,
            SessionLocal,
            search_client,
            settings.KAFKA_ORDER_EVENTS_TOPIC,
        )
    finally:
        consumer.close()
        if search_client is not None:
            search_client.close()


if __name__ == "__main__":
    main()
