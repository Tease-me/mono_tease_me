"""Add influencer landing assets json

Revision ID: 9f2b502b1f98
Revises: 0c3b07e6f23c
Create Date: 2026-03-23 04:48:26.165020

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9f2b502b1f98"
down_revision: Union[str, Sequence[str], None] = "0c3b07e6f23c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "influencers",
        sa.Column(
            "assets_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("influencers", "assets_json")
    # ### end Alembic commands ###
