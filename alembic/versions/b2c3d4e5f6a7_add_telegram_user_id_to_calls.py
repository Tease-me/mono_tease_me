"""add telegram_user_id to calls

Revision ID: b2c3d4e5f6a7
Revises: a7fd0f87cb08
Create Date: 2026-03-19 11:47:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a7fd0f87cb08'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('calls', sa.Column('telegram_user_id', sa.BigInteger(), nullable=True))
    op.create_index('ix_calls_telegram_user_id', 'calls', ['telegram_user_id'])


def downgrade() -> None:
    op.drop_index('ix_calls_telegram_user_id', table_name='calls')
    op.drop_column('calls', 'telegram_user_id')
