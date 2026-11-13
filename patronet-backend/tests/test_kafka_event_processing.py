import json
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from opensearchpy.exceptions import OpenSearchException
from sqlalchemy import create_engine, event, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import settings
from app.db.base import Base
from app.models.category import Category
from app.models.inventory import Inventory
from app.models.outbox_event import OutboxEvent
from app.models.product import Product
from app.models.product_image import ProductImage
from app.models.store import Store
from app.schemas.events import OrderPlacedMessage
from app.services import kafka_consumer, product_search
from app.services.kafka_producer import inspect_kafka_topic
from app.services.outbox_publisher import (
    publish_pending_events,
)


@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


def _order_payload(product_id: UUID, store_id: UUID) -> dict:
    order_id = uuid4()
    return {
        "order_id": str(order_id),
        "customer_id": str(uuid4()),
        "order_number": f"PAT-{uuid4().hex.upper()}",
        "event_type": "order.placed",
        "status": "placed",
        "payment_status": "simulated",
        "payment_method": "simulated",
        "subtotal": "20.00",
        "total_amount": "20.00",
        "delivery_address": {
            "full_name": "Test Customer",
            "phone": "9876543210",
            "address_line": "1 Test Road",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560001",
        },
        "items": [
            {
                "product_id": str(product_id),
                "product_name": "Event Product",
                "sku": "EVENT-1",
                "store_id": str(store_id),
                "quantity": 2,
                "unit_price": "10.00",
                "subtotal": "20.00",
            }
        ],
    }


def _event_envelope(product_id: UUID, store_id: UUID) -> dict:
    payload = _order_payload(product_id, store_id)
    return {
        "event_id": str(uuid4()),
        "event_type": "order.placed",
        "aggregate_type": "order",
        "aggregate_id": payload["order_id"],
        "created_at": datetime.now(UTC).isoformat(),
        "payload": payload,
    }


def _outbox_payload() -> dict:
    return {
        "order_id": str(uuid4()),
        "customer_id": str(uuid4()),
        "order_number": "PAT-OUTBOX-TEST",
        "event_type": "order.placed",
        "status": "placed",
        "payment_status": "simulated",
        "payment_method": "simulated",
        "subtotal": "20.00",
        "total_amount": "20.00",
        "delivery_address": {
            "full_name": "Test Customer",
            "phone": "9876543210",
            "address_line": "1 Test Road",
            "city": "Bengaluru",
            "state": "Karnataka",
            "pincode": "560001",
        },
        "items": [],
    }


@dataclass(frozen=True)
class OutboxContext:
    engine: object
    session_factory: sessionmaker[Session]
    event_id: UUID


@pytest.fixture
def outbox_context() -> Iterator[OutboxContext]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine, tables=[OutboxEvent.__table__])
    test_session = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
    event_id = uuid4()
    with test_session() as session:
        session.add(
            OutboxEvent(
                event_id=event_id,
                aggregate_type="order",
                aggregate_id=uuid4(),
                event_type="order.placed",
                payload=_outbox_payload(),
                status="pending",
            )
        )
        session.commit()
    try:
        yield OutboxContext(
            engine=engine,
            session_factory=test_session,
            event_id=event_id,
        )
    finally:
        engine.dispose()


@dataclass(frozen=True)
class SearchContext:
    engine: object
    session_factory: sessionmaker[Session]
    product_id: UUID
    store_id: UUID


@pytest.fixture
def search_context() -> Iterator[SearchContext]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(
        engine,
        tables=[
            Category.__table__,
            Product.__table__,
            ProductImage.__table__,
            Store.__table__,
            Inventory.__table__,
        ],
    )
    test_session = sessionmaker(bind=engine, class_=Session, expire_on_commit=False)
    with test_session() as session:
        category = Category(name="Kafka Test Category")
        store = Store(
            name="Kafka Test Store",
            city="Bengaluru",
            state="Karnataka",
            pincode="560001",
            address="1 Test Road",
            is_active=True,
        )
        product = Product(
            category=category,
            name="Event Product",
            description="Product for Kafka event synchronization tests.",
            brand="Test Brand",
            sku="EVENT-1",
            price=Decimal("10.00"),
            is_active=True,
        )
        session.add_all([category, store, product])
        session.flush()
        session.add_all(
            [
                ProductImage(
                    product_id=product.id,
                    image_url="https://example.test/event.png",
                    is_primary=True,
                    display_order=0,
                ),
                Inventory(
                    product_id=product.id,
                    store_id=store.id,
                    available_stock=3,
                ),
            ]
        )
        session.commit()
        product_id = product.id
        store_id = store.id
    try:
        yield SearchContext(
            engine=engine,
            session_factory=test_session,
            product_id=product_id,
            store_id=store_id,
        )
    finally:
        engine.dispose()


class FakeProducer:
    def __init__(
        self,
        *,
        delivery_error=None,
        remaining: int = 0,
        callback: bool = True,
    ):
        self.delivery_error = delivery_error
        self.remaining = remaining
        self.invoke_callback = callback
        self.messages = []
        self.flush_calls = 0

    def produce(self, **kwargs):
        self.messages.append(kwargs)
        if self.invoke_callback:
            kwargs["on_delivery"](self.delivery_error, object())

    def flush(self, _timeout):
        self.flush_calls += 1
        return self.remaining


class FakeMessage:
    def __init__(self, value: bytes):
        self._value = value

    def value(self):
        return self._value


class FakeConsumer:
    def __init__(self, order: list[str] | None = None):
        self.commits = []
        self.order = order if order is not None else []

    def commit(self, *, message, asynchronous):
        self.order.append("commit")
        self.commits.append((message, asynchronous))
        return []


@contextmanager
def _acquired_event_lock(_engine, _event_id):
    yield True


@contextmanager
def _busy_event_lock(_engine, _event_id):
    yield False


def test_outbox_publishes_with_event_id_key_and_marks_after_confirmation(
    outbox_context: OutboxContext,
):
    producer = FakeProducer()

    result = publish_pending_events(
        outbox_context.session_factory,
        outbox_context.engine,
        producer,
        "patronet.orders",
        lock_factory=_acquired_event_lock,
    )

    assert result.published == 1
    assert result.failed == result.skipped == 0
    assert producer.flush_calls == 1
    message = producer.messages[0]
    assert message["topic"] == "patronet.orders"
    assert message["key"] == str(outbox_context.event_id)
    envelope = json.loads(message["value"])
    assert envelope["event_type"] == "order.placed"
    assert envelope["event_id"] == str(outbox_context.event_id)
    with outbox_context.session_factory() as session:
        saved = session.scalar(select(OutboxEvent))
    assert saved.status == "published"
    assert saved.published_at is not None


def test_failed_delivery_stays_pending_and_retries_safely(
    outbox_context: OutboxContext,
):
    failed_producer = FakeProducer(delivery_error="broker unavailable")

    failed = publish_pending_events(
        outbox_context.session_factory,
        outbox_context.engine,
        failed_producer,
        "patronet.orders",
        lock_factory=_acquired_event_lock,
    )
    with outbox_context.session_factory() as session:
        pending = session.scalar(select(OutboxEvent))
        assert pending.status == "pending"
        assert pending.published_at is None

    successful = publish_pending_events(
        outbox_context.session_factory,
        outbox_context.engine,
        FakeProducer(),
        "patronet.orders",
        lock_factory=_acquired_event_lock,
    )

    assert failed.failed == 1
    assert successful.published == 1
    with outbox_context.session_factory() as session:
        assert session.scalar(select(OutboxEvent)).status == "published"


def test_unconfirmed_delivery_and_busy_claim_do_not_mark_event_published(
    outbox_context: OutboxContext,
):
    unconfirmed = publish_pending_events(
        outbox_context.session_factory,
        outbox_context.engine,
        FakeProducer(callback=False),
        "patronet.orders",
        lock_factory=_acquired_event_lock,
    )
    busy = publish_pending_events(
        outbox_context.session_factory,
        outbox_context.engine,
        FakeProducer(),
        "patronet.orders",
        lock_factory=_busy_event_lock,
    )

    assert unconfirmed.failed == 1
    assert busy.skipped == 1
    with outbox_context.session_factory() as session:
        assert session.scalar(select(OutboxEvent)).status == "pending"


def test_consumer_factory_uses_manual_offset_commit_and_tls_settings(
    monkeypatch: pytest.MonkeyPatch,
):
    captured = {}

    class ConsumerStub:
        def __init__(self, config):
            captured.update(config)

    monkeypatch.setattr(kafka_consumer, "Consumer", ConsumerStub)
    monkeypatch.setattr(settings, "KAFKA_BOOTSTRAP_SERVERS", "broker.example:9092")
    monkeypatch.setattr(settings, "KAFKA_SECURITY_PROTOCOL", "SASL_SSL")
    monkeypatch.setattr(settings, "KAFKA_SASL_MECHANISM", "PLAIN")
    monkeypatch.setattr(settings, "KAFKA_USERNAME", "test-user")
    monkeypatch.setattr(settings, "KAFKA_PASSWORD", "test-password")
    monkeypatch.setattr(settings, "KAFKA_CA_LOCATION", "local-ca.pem")
    monkeypatch.setattr(settings, "KAFKA_ORDER_EVENTS_TOPIC", "patronet.orders")
    monkeypatch.setattr(
        settings,
        "KAFKA_ORDER_EVENTS_CONSUMER_GROUP",
        "patronet-search-sync",
    )

    kafka_consumer.create_kafka_consumer()

    assert captured["bootstrap.servers"] == "broker.example:9092"
    assert captured["sasl.username"] == "test-user"
    assert captured["sasl.password"] == "test-password"
    assert captured["ssl.ca.location"] == "local-ca.pem"
    assert captured["group.id"] == "patronet-search-sync"
    assert captured["enable.auto.commit"] is False
    assert captured["enable.auto.offset.store"] is False


def test_kafka_topic_check_uses_metadata_without_publishing():
    producer = SimpleNamespace(
        list_topics=lambda timeout: SimpleNamespace(
            brokers={2: object(), 1: object()},
            topics={
                "patronet.orders": SimpleNamespace(
                    error=None,
                    partitions={1: object(), 0: object()},
                )
            },
        )
    )

    result = inspect_kafka_topic(producer, "patronet.orders")

    assert result == {
        "brokers": [1, 2],
        "topic": "patronet.orders",
        "partitions": [0, 1],
    }
    assert not hasattr(producer, "produce")


def test_order_event_sync_uses_postgres_stock_and_duplicate_is_idempotent(
    search_context: SearchContext,
    monkeypatch: pytest.MonkeyPatch,
):
    actions = []

    def capture_bulk(_client, bulk_actions, **kwargs):
        actions.extend(bulk_actions)
        assert kwargs["refresh"] == "wait_for"
        assert kwargs["raise_on_error"] is True
        return len(bulk_actions), []

    monkeypatch.setattr(product_search.helpers, "bulk", capture_bulk)
    search_client = SimpleNamespace(
        indices=SimpleNamespace(exists_alias=lambda **_kwargs: True)
    )
    event_body = _event_envelope(search_context.product_id, search_context.store_id)
    decoded = kafka_consumer.decode_order_placed_event(
        json.dumps(event_body).encode("utf-8")
    )

    first_count = kafka_consumer.sync_order_inventory(
        decoded,
        search_context.session_factory,
        search_client,
    )
    second_count = kafka_consumer.sync_order_inventory(
        decoded,
        search_context.session_factory,
        search_client,
    )

    assert first_count == second_count == 1
    assert len(actions) == 2
    assert actions[0]["_op_type"] == "index"
    assert actions[0]["_id"] == str(search_context.product_id)
    assert actions[0]["_source"]["stores"][0]["available_stock"] == 3
    assert actions[1]["_source"] == actions[0]["_source"]
    with search_context.session_factory() as session:
        stock = session.scalar(
            select(Inventory.available_stock).where(
                Inventory.product_id == search_context.product_id
            )
        )
    assert stock == 3


def test_consumer_commits_offset_only_after_successful_sync(
    search_context: SearchContext,
    monkeypatch: pytest.MonkeyPatch,
):
    order = []

    def successful_sync(_event, _factory, _client):
        order.append("sync")
        return 1

    monkeypatch.setattr(kafka_consumer, "sync_order_inventory", successful_sync)
    consumer = FakeConsumer(order)
    message = FakeMessage(
        json.dumps(
            _event_envelope(search_context.product_id, search_context.store_id)
        ).encode("utf-8")
    )

    kafka_consumer.process_order_placed_message(
        message,
        consumer,
        search_context.session_factory,
        object(),
    )

    assert order == ["sync", "commit"]
    assert consumer.commits[0] == (message, False)


def test_consumer_retries_transient_sync_failure_then_commits(
    search_context: SearchContext,
    monkeypatch: pytest.MonkeyPatch,
):
    attempts = []
    sleeps = []

    def fail_once(_event, _factory, _client):
        attempts.append("sync")
        if len(attempts) == 1:
            raise OpenSearchException("temporary unavailable")

    monkeypatch.setattr(kafka_consumer, "sync_order_inventory", fail_once)
    consumer = FakeConsumer(attempts)
    message = FakeMessage(
        json.dumps(
            _event_envelope(search_context.product_id, search_context.store_id)
        ).encode("utf-8")
    )

    kafka_consumer.process_order_placed_message(
        message,
        consumer,
        search_context.session_factory,
        object(),
        retry_backoff_seconds=0.1,
        sleep=sleeps.append,
    )

    assert len(attempts) == 3
    assert sleeps == [0.1]
    assert attempts[-1] == "commit"


def test_malformed_and_exhausted_messages_are_not_committed(
    search_context: SearchContext,
    monkeypatch: pytest.MonkeyPatch,
):
    malformed_consumer = FakeConsumer()
    with pytest.raises(kafka_consumer.MalformedOrderEvent):
        kafka_consumer.process_order_placed_message(
            FakeMessage(b"{not-json"),
            malformed_consumer,
            search_context.session_factory,
            object(),
        )
    assert malformed_consumer.commits == []

    def always_fail(_event, _factory, _client):
        raise OpenSearchException("still unavailable")

    monkeypatch.setattr(kafka_consumer, "sync_order_inventory", always_fail)
    failing_consumer = FakeConsumer()
    valid_message = FakeMessage(
        json.dumps(
            _event_envelope(search_context.product_id, search_context.store_id)
        ).encode("utf-8")
    )
    with pytest.raises(kafka_consumer.OrderEventProcessingError):
        kafka_consumer.process_order_placed_message(
            valid_message,
            failing_consumer,
            search_context.session_factory,
            object(),
            max_attempts=2,
            sleep=lambda _delay: None,
        )
    assert failing_consumer.commits == []


def test_order_event_schema_rejects_mismatched_aggregate(
    search_context: SearchContext,
):
    envelope = _event_envelope(search_context.product_id, search_context.store_id)
    envelope["aggregate_id"] = str(uuid4())

    with pytest.raises(ValueError, match="aggregate_id"):
        OrderPlacedMessage.model_validate(envelope)
