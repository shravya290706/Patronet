
import os
from pathlib import Path

from dotenv import load_dotenv

# Resolve backend root and repository root robustly whether deployed
# as a submodule, in a monorepo, or inside a container at /app
BACKEND_ROOT = Path(__file__).resolve().parents[2]
if (BACKEND_ROOT.parent / ".env").is_file():
    PROJECT_ROOT = BACKEND_ROOT.parent
elif (BACKEND_ROOT / ".env").is_file():
    PROJECT_ROOT = BACKEND_ROOT
elif (BACKEND_ROOT.parent / "patronet-backend").is_dir():
    PROJECT_ROOT = BACKEND_ROOT.parent
else:
    PROJECT_ROOT = BACKEND_ROOT

for env_candidate in [PROJECT_ROOT / ".env", BACKEND_ROOT / ".env", Path(".env")]:
    if env_candidate.is_file():
        load_dotenv(env_candidate)
        break
else:
    load_dotenv()


def _resolve_ca_cert() -> str:
    env_ca = os.getenv("KAFKA_CA_LOCATION")
    if env_ca and Path(env_ca).is_file():
        return env_ca
    candidates = [
        BACKEND_ROOT / "certs" / "ca.pem",
        PROJECT_ROOT / "patronet-backend" / "certs" / "ca.pem",
        PROJECT_ROOT / "certs" / "ca.pem",
        Path("certs/ca.pem"),
    ]
    for c in candidates:
        if c.is_file():
            return str(c.resolve())
    return env_ca or str(BACKEND_ROOT / "certs" / "ca.pem")


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
    KAFKA_CA_LOCATION: str = _resolve_ca_cert()
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

    # Razorpay (Test Mode & Free Mock Mode for Local Development)
    RAZORPAY_KEY_ID: str = os.getenv("RAZORPAY_KEY_ID", "")
    RAZORPAY_KEY_SECRET: str = os.getenv("RAZORPAY_KEY_SECRET", "")
    RAZORPAY_WEBHOOK_SECRET: str = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")



settings = Settings()
