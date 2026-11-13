"""Add customer address details and creation timestamps.

Revision ID: a91d4f7c2e60
Revises: b76e2c1a9f40
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "a91d4f7c2e60"
down_revision: str | Sequence[str] | None = "b76e2c1a9f40"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "addresses",
        sa.Column("address_line_2", sa.Text(), nullable=True),
    )
    op.add_column(
        "addresses",
        sa.Column("country", sa.String(length=100), nullable=True),
    )
    op.add_column(
        "addresses",
        sa.Column("label", sa.String(length=50), nullable=True),
    )
    op.add_column(
        "addresses",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("addresses", "created_at")
    op.drop_column("addresses", "label")
    op.drop_column("addresses", "country")
    op.drop_column("addresses", "address_line_2")
