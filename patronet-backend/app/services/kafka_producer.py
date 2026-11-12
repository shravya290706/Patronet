
from confluent_kafka import Producer

from app.core.config import settings


def create_kafka_producer():
    config = {
        "bootstrap.servers": settings.KAFKA_BOOTSTRAP_SERVERS,
        "security.protocol": settings.KAFKA_SECURITY_PROTOCOL,
        "sasl.mechanism": settings.KAFKA_SASL_MECHANISM,
        "sasl.username": settings.KAFKA_USERNAME,
        "sasl.password": settings.KAFKA_PASSWORD,
        "ssl.ca.location": settings.KAFKA_CA_LOCATION,
    }

    return Producer(config)


def test_kafka_connection():
    producer = create_kafka_producer()

    # Request cluster metadata to verify connectivity and authentication
    metadata = producer.list_topics(timeout=10)

    return {
        "brokers": list(metadata.brokers.keys()),
        "topics": list(metadata.topics.keys()),
    }
