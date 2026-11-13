"""add wishlist_items table

Revision ID: f3a1b2c4d5e6
Revises: a91d4f7c2e60
Create Date: 2026-11-13 18:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f3a1b2c4d5e6"
down_revision: str | Sequence[str] | None = "a91d4f7c2e60"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "wishlist_items",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "customer_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "product_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("products.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "added_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("customer_id", "product_id", name="uq_wishlist_customer_product"),
    )


def downgrade() -> None:
    op.drop_table("wishlist_items")
