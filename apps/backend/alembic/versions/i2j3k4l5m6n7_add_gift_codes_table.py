"""add gift_codes table

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-06-12 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "i2j3k4l5m6n7"
down_revision: Union[str, Sequence[str], None] = "h1i2j3k4l5m6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "gift_codes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("code", sa.String(length=16), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("influencer_id", sa.String(), nullable=False),
        sa.Column("diamonds", sa.Integer(), nullable=False, server_default="120"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["influencer_id"], ["influencers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
        sa.UniqueConstraint("user_id", name="uq_gift_codes_user_id"),
    )
    op.create_index("ix_gift_codes_code", "gift_codes", ["code"], unique=True)
    op.create_index("ix_gift_codes_user_id", "gift_codes", ["user_id"], unique=False)
    op.create_index("ix_gift_codes_influencer_id", "gift_codes", ["influencer_id"], unique=False)
    op.create_index("ix_gift_codes_status", "gift_codes", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_gift_codes_status", table_name="gift_codes")
    op.drop_index("ix_gift_codes_influencer_id", table_name="gift_codes")
    op.drop_index("ix_gift_codes_user_id", table_name="gift_codes")
    op.drop_index("ix_gift_codes_code", table_name="gift_codes")
    op.drop_table("gift_codes")
