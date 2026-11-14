"""Add payment tracking and gift card models.

Revision ID: c8d2e4f6a1b3
Revises: f3a1b2c4d5e6
Create Date: 2026-11-14 14:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c8d2e4f6a1b3"
down_revision: str | Sequence[str] | None = "f3a1b2c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add Razorpay and Gift Card tracking columns to orders table
    op.add_column("orders", sa.Column("razorpay_order_id", sa.String(length=100), nullable=True))
    op.add_column("orders", sa.Column("razorpay_payment_id", sa.String(length=100), nullable=True))
    op.add_column("orders", sa.Column("razorpay_signature", sa.String(length=255), nullable=True))
    op.add_column("orders", sa.Column("gift_card_code", sa.String(length=50), nullable=True))
    op.add_column(
        "orders",
        sa.Column("gift_card_amount", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0.00"),
    )
    op.add_column("orders", sa.Column("payable_amount", sa.Numeric(precision=12, scale=2), nullable=True))

    op.create_index(op.f("ix_orders_razorpay_order_id"), "orders", ["razorpay_order_id"], unique=False)
    op.create_index(op.f("ix_orders_razorpay_payment_id"), "orders", ["razorpay_payment_id"], unique=False)

    # 2. Create gift_cards table
    op.create_table(
        "gift_cards",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("initial_balance", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("current_balance", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=10), nullable=False, server_default="INR"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("current_balance >= 0", name="ck_gift_cards_balance_nonnegative"),
    )
    op.create_index(op.f("ix_gift_cards_code"), "gift_cards", ["code"], unique=True)
    op.create_index(op.f("ix_gift_cards_status"), "gift_cards", ["status"], unique=False)

    # 3. Create gift_card_redemptions table
    op.create_table(
        "gift_card_redemptions",
        sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "gift_card_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("gift_cards.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "order_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("orders.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "customer_id",
            sa.UUID(as_uuid=True),
            sa.ForeignKey("customers.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("amount_deducted", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("amount_deducted > 0", name="ck_redemptions_amount_positive"),
    )
    op.create_index(
        op.f("ix_gift_card_redemptions_gift_card_id"),
        "gift_card_redemptions",
        ["gift_card_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_gift_card_redemptions_order_id"),
        "gift_card_redemptions",
        ["order_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_gift_card_redemptions_customer_id"),
        "gift_card_redemptions",
        ["customer_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("gift_card_redemptions")
    op.drop_table("gift_cards")
    op.drop_index(op.f("ix_orders_razorpay_payment_id"), table_name="orders")
    op.drop_index(op.f("ix_orders_razorpay_order_id"), table_name="orders")
    op.drop_column("orders", "payable_amount")
    op.drop_column("orders", "gift_card_amount")
    op.drop_column("orders", "gift_card_code")
    op.drop_column("orders", "razorpay_signature")
    op.drop_column("orders", "razorpay_payment_id")
    op.drop_column("orders", "razorpay_order_id")
