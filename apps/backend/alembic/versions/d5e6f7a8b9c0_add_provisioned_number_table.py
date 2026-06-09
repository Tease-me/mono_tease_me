"""add provisioned_number table

Revision ID: d5e6f7a8b9c0
Revises: 1648653d7a81
Create Date: 2026-03-27 10:37:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, Sequence[str], None] = '1648653d7a81'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "provisioned_number",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("phone_number", sa.String(32), nullable=False, comment="E.164 phone number"),
        sa.Column("twilio_sid", sa.String(64), nullable=False, comment="Twilio IncomingPhoneNumber SID"),
        sa.Column("country_code", sa.String(4), nullable=False, comment="ISO 2-letter country code"),
        sa.Column("influencer_id", sa.String(), nullable=True, comment="Linked influencer"),
        sa.Column("telegram_session_status", sa.String(20), nullable=False, server_default="pending",
                  comment="pending | code_sent | verified | failed"),
        sa.Column("telegram_user_id", sa.BigInteger(), nullable=True, comment="Telegram user ID"),
        sa.Column("telegram_username", sa.String(128), nullable=True, comment="Telegram username"),
        sa.Column("telegram_first_name", sa.String(128), nullable=True, server_default="User",
                  comment="First name for Telegram sign-up"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true"), comment="Active toggle"),
        sa.Column("error_message", sa.Text(), nullable=True, comment="Last error if status=failed"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["influencer_id"], ["influencers.id"], ondelete="SET NULL"),
        sa.UniqueConstraint("phone_number"),
        sa.UniqueConstraint("twilio_sid"),
    )
    op.create_index("ix_prov_num_status", "provisioned_number", ["telegram_session_status"])
    op.create_index("ix_prov_num_influencer", "provisioned_number", ["influencer_id"])


def downgrade() -> None:
    op.drop_index("ix_prov_num_influencer", table_name="provisioned_number")
    op.drop_index("ix_prov_num_status", table_name="provisioned_number")
    op.drop_table("provisioned_number")
