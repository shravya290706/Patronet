import os

import pytest

RUN_AIVEN_INTEGRATION_TESTS = os.getenv("PATRONET_RUN_AIVEN_INTEGRATION_TESTS") == "1"

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(
        not RUN_AIVEN_INTEGRATION_TESTS,
        reason="Set PATRONET_RUN_AIVEN_INTEGRATION_TESTS=1 to run Aiven smoke tests",
    ),
]


def test_postgres_smoke():
    from sqlalchemy import text

    from app.db.database import engine

    with engine.begin() as connection:
        connection.execute(
            text("""
                CREATE TABLE IF NOT EXISTS integration_test (
                    id SERIAL PRIMARY KEY,
                    message TEXT NOT NULL
                )
            """)
        )

        connection.execute(
            text("""
                INSERT INTO integration_test (message)
                VALUES (:message)
            """),
            {"message": "PATRONET PostgreSQL integration successful"},
        )

        result = connection.execute(
            text("""
                SELECT message
                FROM integration_test
                ORDER BY id DESC
                LIMIT 1
            """)
        ).scalar_one()

    assert result == "PATRONET PostgreSQL integration successful"
