
from sqlalchemy import URL, create_engine, text

from app.core.config import settings

database_url = URL.create(
    drivername="postgresql+psycopg",
    username=settings.POSTGRES_USER,
    password=settings.POSTGRES_PASSWORD,
    host=settings.POSTGRES_HOST,
    port=settings.POSTGRES_PORT,
    database=settings.POSTGRES_DATABASE,
    query={"sslmode": settings.POSTGRES_SSLMODE},
)

engine = create_engine(database_url, pool_pre_ping=True)


def test_database_connection():
    with engine.connect() as connection:
        result = connection.execute(text("SELECT version()"))
        return result.scalar()
