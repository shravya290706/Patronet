from sqlalchemy import text

from app.db.database import engine

with engine.begin() as connection:
    connection.execute(text("""
        CREATE TABLE IF NOT EXISTS integration_test (
            id SERIAL PRIMARY KEY,
            message TEXT NOT NULL
        )
    """))

    connection.execute(
        text("""
            INSERT INTO integration_test (message)
            VALUES (:message)
        """),
        {"message": "PATRONET PostgreSQL integration successful"}
    )

    result = connection.execute(
        text("""
            SELECT message
            FROM integration_test
            ORDER BY id DESC
            LIMIT 1
        """)
    )

    print(result.scalar())