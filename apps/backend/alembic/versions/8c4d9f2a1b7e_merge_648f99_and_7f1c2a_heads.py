"""merge_648f99_and_7f1c2a_heads

Revision ID: 8c4d9f2a1b7e
Revises: 648f99a32893, 7f1c2a8b9d4e
Create Date: 2026-04-20 10:30:00.000000

"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "8c4d9f2a1b7e"
down_revision: Union[str, Sequence[str], None] = ("648f99a32893", "7f1c2a8b9d4e")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge revision heads."""
    pass


def downgrade() -> None:
    """Unmerge revision heads."""
    pass
