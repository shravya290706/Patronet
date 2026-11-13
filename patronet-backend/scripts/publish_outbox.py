"""Run the PostgreSQL transactional outbox publisher."""

import logging

from app.core.config import settings
from app.db.database import SessionLocal, engine
from app.services.kafka_producer import create_kafka_producer
from app.services.outbox_publisher import run_publisher

logger = logging.getLogger(__name__)


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    if not settings.KAFKA_ORDER_EVENTS_TOPIC:
        raise RuntimeError("Set KAFKA_ORDER_EVENTS_TOPIC before starting the publisher.")

    producer = create_kafka_producer()
    try:
        run_publisher(
            SessionLocal,
            engine,
            producer,
            settings.KAFKA_ORDER_EVENTS_TOPIC,
        )
    finally:
        remaining = producer.flush(10)
        if remaining:
            logger.error("Publisher shutdown with %s unconfirmed message(s)", remaining)


if __name__ == "__main__":
    main()
