
from confluent_kafka import Producer

from app.core.config import settings


def kafka_security_config() -> dict[str, object]:
    config = {
        "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
        "security.protocol": settings.KAFKA_SECURITY_PROTOCOL,
        "ssl.ca.location": settings.KAFKA_CA_LOCATION,
    }
    if settings.KAFKA_SECURITY_PROTOCOL.startswith("SASL"):
        config.update(
            {
                "sasl.mechanism": settings.KAFKA_SASL_MECHANISM,
                "sasl.username": settings.KAFKA_USERNAME,
                "sasl.password": settings.KAFKA_PASSWORD,
            }
        )
    return config


def create_kafka_producer() -> Producer:
    config = kafka_security_config()
    config.update({"enable.idempotence": True, "acks": "all"})

    return Producer(config)


def test_kafka_connection():
    producer = create_kafka_producer()

    # Request cluster metadata to verify connectivity and authentication
    metadata = producer.list_topics(timeout=10)

    return {
        "brokers": list(metadata.brokers.keys()),
        "topics": list(metadata.topics.keys()),
    }


def inspect_kafka_topic(producer: Producer, topic: str) -> dict[str, object]:
    if not topic:
        raise ValueError("Kafka order events topic must be configured.")
    metadata = producer.list_topics(timeout=10)
    topic_metadata = metadata.topics.get(topic)
    if topic_metadata is None:
        raise RuntimeError(
            f"Configured Kafka topic {topic!r} does not exist; no topic was created."
        )
    if topic_metadata.error is not None:
        raise RuntimeError(f"Could not inspect Kafka topic {topic!r}: {topic_metadata.error}")
    return {
        "brokers": sorted(metadata.brokers),
        "topic": topic,
        "partitions": sorted(topic_metadata.partitions),
    }
