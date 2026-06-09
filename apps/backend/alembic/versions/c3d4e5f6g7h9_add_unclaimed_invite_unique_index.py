"""add unclaimed invite unique index

Revision ID: c3d4e5f6g7h9
Revises: b2c3d4e5f6g8
Create Date: 2026-03-23 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6g7h9'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6g8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_telegram_invite_unclaimed_unique",
        "telegram_invite",
        ["telegram_user_id", "influencer_id"],
        unique=True,
        postgresql_where=sa.text("is_claimed = false"),
    )


def downgrade() -> None:
    op.drop_index(
        "ix_telegram_invite_unclaimed_unique",
        table_name="telegram_invite",
    )
