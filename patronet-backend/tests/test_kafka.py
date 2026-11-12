
import json

from confluent_kafka import Consumer

from app.core.config import settings
from app.services.kafka_producer import create_kafka_producer

TOPIC = "patronet.test.events"

producer = create_kafka_producer()

producer.produce(
    TOPIC,
    key="test-001",
    value=json.dumps({
        "event": "patronet.integration.test",
        "message": "PATRONET Kafka integration successful"
    })
)

producer.flush(10)

consumer = Consumer({
    "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
    "security.protocol": settings.KAFKA_SECURITY_PROTOCOL,
    "sasl.mechanism": settings.KAFKA_SASL_MECHANISM,
    "sasl.username": settings.KAFKA_USERNAME,
    "sasl.password": settings.KAFKA_PASSWORD,
    "ssl.ca.location": settings.KAFKA_CA_LOCATION,
    "group.id": "patronet-integration-test",
    "auto.offset.reset": "earliest",
})

consumer.subscribe([TOPIC])

try:
    message = consumer.poll(15)

    if message is None:
        print("No message received. Check topic creation and permissions.")
    elif message.error():
        print("Kafka error:", message.error())
    else:
        print("Received:", message.value().decode("utf-8"))

finally:
    consumer.close()
