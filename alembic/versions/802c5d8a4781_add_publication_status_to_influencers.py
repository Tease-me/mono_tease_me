"""Add publication status to influencers

Revision ID: 802c5d8a4781
Revises: cb0ae8ad63ee
Create Date: 2026-04-22 07:01:14.799717

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "802c5d8a4781"
down_revision: Union[str, Sequence[str], None] = "cb0ae8ad63ee"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "influencers",
        sa.Column(
            "publication_status",
            sa.String(),
            nullable=False,
            server_default="draft",
        ),
    )
    op.alter_column("influencers", "publication_status", server_default=None)
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("influencers", "publication_status")
    # ### end Alembic commands ###
