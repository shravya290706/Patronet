
import os
from pathlib import Path

from dotenv import load_dotenv

# Locate the .env file in the repository root
PROJECT_ROOT = Path(__file__).resolve().parents[3]
ENV_FILE = PROJECT_ROOT / ".env"

load_dotenv(ENV_FILE)


class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "PATRONET")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"

    # Authentication
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "")
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("JWT_ACCESS_TOKEN_EXPIRE_MINUTES", "30")
    )

    # PostgreSQL
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_DATABASE: str = os.getenv("POSTGRES_DATABASE", "")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "")
    POSTGRES_SSLMODE: str = os.getenv("POSTGRES_SSLMODE", "require")

    # Kafka
    KAFKA_BOOTSTRAP_SERVERS: str = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "")
    KAFKA_USERNAME: str = os.getenv("KAFKA_USERNAME", "")
    KAFKA_PASSWORD: str = os.getenv("KAFKA_PASSWORD", "")
    KAFKA_SECURITY_PROTOCOL: str = os.getenv(
        "KAFKA_SECURITY_PROTOCOL", "SASL_SSL"
    )
    KAFKA_SASL_MECHANISM: str = os.getenv(
        "KAFKA_SASL_MECHANISM", "PLAIN"
    )
    KAFKA_CA_LOCATION: str = os.getenv("KAFKA_CA_LOCATION") or str(
        PROJECT_ROOT / "patronet-backend" / "certs" / "ca.pem"
    )
    KAFKA_ORDER_EVENTS_TOPIC: str = os.getenv("KAFKA_ORDER_EVENTS_TOPIC", "")
    KAFKA_ORDER_EVENTS_CONSUMER_GROUP: str = os.getenv(
        "KAFKA_ORDER_EVENTS_CONSUMER_GROUP", ""
    )

    # OpenSearch
    OPENSEARCH_HOST: str = os.getenv("OPENSEARCH_HOST", "")
    OPENSEARCH_PORT: int = int(os.getenv("OPENSEARCH_PORT", "443"))
    OPENSEARCH_USERNAME: str = os.getenv("OPENSEARCH_USERNAME", "")
    OPENSEARCH_PASSWORD: str = os.getenv("OPENSEARCH_PASSWORD", "")
    OPENSEARCH_USE_SSL: bool = (
        os.getenv("OPENSEARCH_USE_SSL", "true").lower() == "true"
    )


settings = Settings()
