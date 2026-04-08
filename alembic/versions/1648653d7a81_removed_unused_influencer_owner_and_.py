"""Removed Unused Influencer Owner and Prompts

Revision ID: 1648653d7a81
Revises: 9f2b502b1f98
Create Date: 2026-03-23 05:37:03.742867

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1648653d7a81"
down_revision: Union[str, Sequence[str], None] = "9f2b502b1f98"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_column("influencers", "custom_adult_prompt")
    op.drop_column("influencers", "custom_audio_prompt")
    op.drop_column("influencers", "owner_id")
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column(
        "influencers",
        sa.Column("owner_id", sa.INTEGER(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "influencers",
        sa.Column("custom_audio_prompt", sa.TEXT(), autoincrement=False, nullable=True),
    )
    op.add_column(
        "influencers",
        sa.Column("custom_adult_prompt", sa.TEXT(), autoincrement=False, nullable=True),
    )
    # ### end Alembic commands ###
