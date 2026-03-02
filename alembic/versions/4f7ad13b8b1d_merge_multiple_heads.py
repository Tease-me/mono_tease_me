"""Merge multiple heads

Revision ID: 4f7ad13b8b1d
Revises: 7c351d626ca2, f917cb01bc79
Create Date: 2026-02-25 02:42:04.747774

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4f7ad13b8b1d'
down_revision: Union[str, Sequence[str], None] = ('7c351d626ca2', 'f917cb01bc79')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
