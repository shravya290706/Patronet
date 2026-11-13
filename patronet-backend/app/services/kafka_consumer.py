import logging
import time
from collections.abc import Callable
from typing import Any

from confluent_kafka import Consumer, KafkaError, KafkaException
from opensearchpy import OpenSearch
from opensearchpy.exceptions import OpenSearchException
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.schemas.events import OrderPlacedMessage
from app.services.kafka_producer import kafka_security_config
from app.services.product_search import sync_products_to_search

logger = logging.getLogger(__name__)


class MalformedOrderEvent(ValueError):
    pass


class OrderEventProcessingError(RuntimeError):
    pass


class KafkaOffsetCommitError(RuntimeError):
    pass


def create_kafka_consumer() -> Consumer:
    if not settings.KAFKA_ORDER_EVENTS_TOPIC:
        raise RuntimeError("KAFKA_ORDER_EVENTS_TOPIC must be configured.")
    if not settings.KAFKA_ORDER_EVENTS_CONSUMER_GROUP:
        raise RuntimeError("KAFKA_ORDER_EVENTS_CONSUMER_GROUP must be configured.")

    config: dict[str, Any] = kafka_security_config()
    config.update(
        {
            "group.id": settings.KAFKA_ORDER_EVENTS_CONSUMER_GROUP,
            "enable.auto.commit": False,
            "enable.auto.offset.store": False,
            "auto.offset.reset": "earliest",
        }
    )
    return Consumer(config)


def decode_order_placed_event(value: bytes | None) -> OrderPlacedMessage:
    if value is None:
        raise MalformedOrderEvent("Kafka message has no value.")
    try:
        return OrderPlacedMessage.model_validate_json(value)
    except (ValidationError, ValueError, UnicodeDecodeError) as error:
        raise MalformedOrderEvent("Kafka message is not a valid order.placed event.") from error


def sync_order_inventory(
    event: OrderPlacedMessage,
    session_factory: sessionmaker[Session],
    search_client: OpenSearch,
) -> int:
    product_ids = {item.product_id for item in event.payload.items}
    with session_factory() as session:
        return sync_products_to_search(session, search_client, product_ids)


def _commit_offset(consumer: Consumer, message) -> None:
    partitions = consumer.commit(message=message, asynchronous=False)
    if partitions is None:
        return
    errors = [partition.error for partition in partitions if partition.error]
    if errors:
        raise KafkaOffsetCommitError(
            f"Kafka offset commit failed: {', '.join(map(str, errors))}"
        )


def process_order_placed_message(
    message,
    consumer: Consumer,
    session_factory: sessionmaker[Session],
    search_client: OpenSearch,
    *,
    max_attempts: int = 3,
    retry_backoff_seconds: float = 0.5,
    sleep: Callable[[float], None] = time.sleep,
) -> OrderPlacedMessage:
    if max_attempts < 1:
        raise ValueError("max_attempts must be at least one.")

    event = decode_order_placed_event(message.value())
    for attempt in range(1, max_attempts + 1):
        try:
            sync_order_inventory(event, session_factory, search_client)
            break
        except (OpenSearchException, SQLAlchemyError, ConnectionError, TimeoutError) as error:
            if attempt == max_attempts:
                raise OrderEventProcessingError(
                    f"Inventory synchronization failed after {max_attempts} attempts."
                ) from error
            logger.warning(
                "Inventory synchronization attempt %s/%s failed for event %s",
                attempt,
                max_attempts,
                event.event_id,
                exc_info=True,
            )
            sleep(retry_backoff_seconds * (2 ** (attempt - 1)))

    _commit_offset(consumer, message)
    return event


def run_order_event_consumer(
    consumer: Consumer,
    session_factory: sessionmaker[Session],
    search_client: OpenSearch,
    topic: str,
    *,
    poll_timeout: float = 1.0,
) -> None:
    if not topic:
        raise ValueError("Kafka order events topic must be configured.")
    consumer.subscribe([topic])
    while True:
        message = consumer.poll(poll_timeout)
        if message is None:
            continue
        message_error = message.error()
        if message_error is not None:
            if message_error.code() == KafkaError._PARTITION_EOF:
                continue
            raise KafkaException(message_error)
        try:
            event = process_order_placed_message(
                message,
                consumer,
                session_factory,
                search_client,
            )
        except MalformedOrderEvent:
            logger.exception(
                "Malformed Kafka order event at %s[%s] offset %s; offset not committed",
                message.topic(),
                message.partition(),
                message.offset(),
            )
            raise
        except (
            OrderEventProcessingError,
            KafkaOffsetCommitError,
            KafkaException,
            OpenSearchException,
            SQLAlchemyError,
            ValueError,
        ):
            logger.exception(
                "Could not process Kafka order event at %s[%s] offset %s; "
                "offset not committed",
                message.topic(),
                message.partition(),
                message.offset(),
            )
            raise
        logger.info("Synchronized inventory for order event %s", event.event_id)
