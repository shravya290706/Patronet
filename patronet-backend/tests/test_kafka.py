
import os

import pytest

RUN_AIVEN_INTEGRATION_TESTS = os.getenv("PATRONET_RUN_AIVEN_INTEGRATION_TESTS") == "1"
TOPIC = "patronet.test.events"

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not RUN_AIVEN_INTEGRATION_TESTS,
        reason="Set PATRONET_RUN_AIVEN_INTEGRATION_TESTS=1 to run Aiven smoke tests",
    ),
]


def test_kafka_smoke():
    import json

    from confluent_kafka import Consumer

    from app.core.config import settings
    from app.services.kafka_producer import create_kafka_producer

    producer = create_kafka_producer()
    producer.produce(
        TOPIC,
        key="test-001",
        value=json.dumps(
            {
                "event": "patronet.integration.test",
                "message": "PATRONET Kafka integration successful",
            }
        ),
    )
    assert producer.flush(10) == 0

    consumer = Consumer(
        {
            "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
            "security.protocol": settings.KAFKA_SECURITY_PROTOCOL,
            "sasl.mechanism": settings.KAFKA_SASL_MECHANISM,
            "sasl.username": settings.KAFKA_USERNAME,
            "sasl.password": settings.KAFKA_PASSWORD,
            "ssl.ca.location": settings.KAFKA_CA_LOCATION,
            "group.id": "patronet-integration-test",
            "auto.offset.reset": "earliest",
        }
    )

    consumer.subscribe([TOPIC])
    try:
        message = consumer.poll(15)
        assert message is not None, "No message received; check topic and permissions"
        assert message.error() is None, f"Kafka error: {message.error()}"
        payload = json.loads(message.value().decode("utf-8"))
        assert payload["event"] == "patronet.integration.test"
        print("Received:", payload)
    finally:
        consumer.close()
