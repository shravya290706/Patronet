"""Add structured specifications to products.

Revision ID: b76e2c1a9f40
Revises: 7662a07f2f4e
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b76e2c1a9f40"
down_revision: str | Sequence[str] | None = "7662a07f2f4e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "specifications",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default=sa.text("'{}'::jsonb"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("products", "specifications")
