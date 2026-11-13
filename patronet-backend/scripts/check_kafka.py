"""Check configured Kafka connectivity and topic metadata without publishing."""

import json

from app.core.config import settings
from app.services.kafka_producer import create_kafka_producer, inspect_kafka_topic


def main() -> None:
    if not settings.KAFKA_ORDER_EVENTS_TOPIC:
        raise RuntimeError("Set KAFKA_ORDER_EVENTS_TOPIC before checking Kafka.")

    producer = create_kafka_producer()
    try:
        metadata = inspect_kafka_topic(producer, settings.KAFKA_ORDER_EVENTS_TOPIC)
    finally:
        producer.flush(10)
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
