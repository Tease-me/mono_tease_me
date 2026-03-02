"""merge_heads

Revision ID: 03abb4e4e45f
Revises: d4e5f6a7b8c9, g5h6i7j8k9l0
Create Date: 2026-02-13 05:18:56.480405

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '03abb4e4e45f'
down_revision: Union[str, Sequence[str], None] = ('d4e5f6a7b8c9', 'g5h6i7j8k9l0')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
