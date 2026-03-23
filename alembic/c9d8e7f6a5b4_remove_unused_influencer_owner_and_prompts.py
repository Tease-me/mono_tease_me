"""remove_unused_influencer_owner_and_prompts

Revision ID: c9d8e7f6a5b4
Revises: 9f2b502b1f98
Create Date: 2026-03-23 13:00:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c9d8e7f6a5b4"
down_revision: Union[str, Sequence[str], None] = "9f2b502b1f98"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("influencers", "owner_id")
    op.drop_column("influencers", "custom_adult_prompt")
    op.drop_column("influencers", "custom_audio_prompt")


def downgrade() -> None:
    op.add_column(
        "influencers", sa.Column("custom_audio_prompt", sa.Text(), nullable=True)
    )
    op.add_column(
        "influencers", sa.Column("custom_adult_prompt", sa.Text(), nullable=True)
    )
    op.add_column("influencers", sa.Column("owner_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "influencers",
        "users",
        ["owner_id"],
        ["id"],
    )
