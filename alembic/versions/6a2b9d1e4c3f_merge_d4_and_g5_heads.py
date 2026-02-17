"""merge_d4_and_g5_heads

Revision ID: 6a2b9d1e4c3f
Revises: d4e5f6a7b8c9, g5h6i7j8k9l0
Create Date: 2026-02-16 15:05:00.000000

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "6a2b9d1e4c3f"
down_revision: Union[str, Sequence[str], None] = ("d4e5f6a7b8c9", "g5h6i7j8k9l0")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Merge revision heads."""
    pass


def downgrade() -> None:
    """Unmerge revision heads."""
    pass
