"""merge heads

Revision ID: 8297a97dc75d
Revises: a1b2c3d4e5f6, aa619402664a
Create Date: 2026-03-02 10:26:45.752164

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8297a97dc75d'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f6', 'aa619402664a')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
