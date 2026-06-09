"""make user_id nullable on chats and calls for telegram users

Revision ID: 0c3b07e6f23c
Revises: c3d4e5f6g7h9
Create Date: 2026-03-23 02:55:19.208013

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '0c3b07e6f23c'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6g7h9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('calls', 'user_id',
               existing_type=sa.INTEGER(),
               nullable=True)
    op.alter_column('chats', 'user_id',
               existing_type=sa.INTEGER(),
               nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('chats', 'user_id',
               existing_type=sa.INTEGER(),
               nullable=False)
    op.alter_column('calls', 'user_id',
               existing_type=sa.INTEGER(),
               nullable=False)
