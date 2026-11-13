import hashlib
import json
import logging
import time
from collections.abc import Callable, Iterator
from contextlib import AbstractContextManager, contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

from confluent_kafka import KafkaException
from sqlalchemy import Engine, select, text, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.models.outbox_event import OutboxEvent

logger = logging.getLogger(__name__)


class KafkaDeliveryError(RuntimeError):
    pass


@dataclass(frozen=True)
class PublishResult:
    published: int = 0
    failed: int = 0
    skipped: int = 0


def _lock_key(event_id: UUID) -> int:
    digest = hashlib.sha256(event_id.bytes).digest()
    return int.from_bytes(digest[:8], byteorder="big", signed=True)


@contextmanager
def event_advisory_lock(engine: Engine, event_id: UUID) -> Iterator[bool]:
    """Claim one event with a session lock but no transaction during delivery."""
    connection = engine.connect()
    lock_key = _lock_key(event_id)
    acquired = False
    try:
        acquired = bool(
            connection.execute(
                text("SELECT pg_try_advisory_lock(:lock_key)"),
                {"lock_key": lock_key},
            ).scalar_one()
        )
        connection.commit()
        yield acquired
    finally:
        if acquired:
            try:
                unlocked = connection.execute(
                    text("SELECT pg_advisory_unlock(:lock_key)"),
                    {"lock_key": lock_key},
                ).scalar_one()
                connection.commit()
                if not unlocked:
                    logger.error("Could not release outbox lock for event %s", event_id)
                    connection.invalidate()
            except SQLAlchemyError:
                logger.exception("Could not release outbox lock for event %s", event_id)
                connection.invalidate()
        connection.close()


def _event_envelope(event: OutboxEvent) -> dict:
    return {
        "event_id": str(event.event_id),
        "event_type": event.event_type,
        "aggregate_type": event.aggregate_type,
        "aggregate_id": str(event.aggregate_id),
        "created_at": event.created_at.isoformat(),
        "payload": event.payload,
    }


def _deliver_event(
    producer,
    topic: str,
    event_id: UUID,
    envelope: dict,
    timeout: float,
) -> None:
    delivery = {"called": False, "error": None}

    def on_delivery(error, _message):
        delivery["called"] = True
        delivery["error"] = error

    producer.produce(
        topic=topic,
        key=str(event_id),
        value=json.dumps(envelope, separators=(",", ":"), ensure_ascii=False).encode(
            "utf-8"
        ),
        on_delivery=on_delivery,
    )
    remaining = producer.flush(timeout)
    if remaining:
        raise KafkaDeliveryError(
            f"Kafka delivery timed out with {remaining} message(s) pending."
        )
    if not delivery["called"]:
        raise KafkaDeliveryError("Kafka did not confirm message delivery.")
    if delivery["error"] is not None:
        raise KafkaDeliveryError(f"Kafka delivery failed: {delivery['error']}")


def publish_pending_events(
    session_factory: sessionmaker[Session],
    engine: Engine,
    producer,
    topic: str,
    *,
    batch_size: int = 100,
    delivery_timeout: float = 10.0,
    lock_factory: Callable[[Engine, UUID], AbstractContextManager[bool]] = event_advisory_lock,
) -> PublishResult:
    if batch_size < 1:
        raise ValueError("batch_size must be positive.")
    if not topic:
        raise ValueError("Kafka order events topic must be configured.")

    published = 0
    failed = 0
    skipped = 0
    last_event_id: UUID | None = None

    while True:
        with session_factory() as session:
            statement = select(OutboxEvent.event_id).where(
                OutboxEvent.status == "pending",
                OutboxEvent.event_type == "order.placed",
            )
            if last_event_id is not None:
                statement = statement.where(OutboxEvent.event_id > last_event_id)
            event_ids = list(
                session.scalars(
                    statement.order_by(OutboxEvent.event_id).limit(batch_size)
                ).all()
            )

        if not event_ids:
            break

        for event_id in event_ids:
            last_event_id = event_id
            with lock_factory(engine, event_id) as acquired:
                if not acquired:
                    skipped += 1
                    continue

                with session_factory() as session:
                    event = session.scalar(
                        select(OutboxEvent).where(
                            OutboxEvent.event_id == event_id,
                            OutboxEvent.status == "pending",
                            OutboxEvent.event_type == "order.placed",
                        )
                    )
                    envelope = _event_envelope(event) if event is not None else None

                if envelope is None:
                    skipped += 1
                    continue

                try:
                    _deliver_event(
                        producer,
                        topic,
                        event_id,
                        envelope,
                        delivery_timeout,
                    )
                except (KafkaDeliveryError, KafkaException, BufferError, TimeoutError):
                    failed += 1
                    logger.exception("Failed to publish outbox event %s", event_id)
                    continue

                with session_factory() as session:
                    result = session.execute(
                        update(OutboxEvent)
                        .where(
                            OutboxEvent.event_id == event_id,
                            OutboxEvent.status == "pending",
                        )
                        .values(
                            status="published",
                            published_at=datetime.now(UTC),
                        )
                    )
                    session.commit()
                    if result.rowcount == 1:
                        published += 1
                    else:
                        skipped += 1

    return PublishResult(published=published, failed=failed, skipped=skipped)


def run_publisher(
    session_factory: sessionmaker[Session],
    engine: Engine,
    producer,
    topic: str,
    *,
    poll_interval: float = 2.0,
) -> None:
    while True:
        result = publish_pending_events(session_factory, engine, producer, topic)
        if result.published or result.failed or result.skipped:
            logger.info(
                "Outbox pass complete: published=%s failed=%s skipped=%s",
                result.published,
                result.failed,
                result.skipped,
            )
        time.sleep(poll_interval)
