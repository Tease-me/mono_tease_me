"""merge heads

Revision ID: aa619402664a
Revises: 4f7ad13b8b1d, 841389b1848c
Create Date: 2026-03-02 05:29:39.104896

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aa619402664a'
down_revision: Union[str, Sequence[str], None] = ('4f7ad13b8b1d', '841389b1848c')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
