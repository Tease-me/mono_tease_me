"""Drop asset keys from influencer character meta

Revision ID: 9b4b3b2f1c0d
Revises: 6fd6b6ee7702
Create Date: 2026-03-16 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9b4b3b2f1c0d"
down_revision: Union[str, Sequence[str], None] = "6fd6b6ee7702"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("influencer_character_meta", "video_key")
    op.drop_column("influencer_character_meta", "photo_key")


def downgrade() -> None:
    op.add_column("influencer_character_meta", sa.Column("photo_key", sa.String(), nullable=True))
    op.add_column("influencer_character_meta", sa.Column("video_key", sa.String(), nullable=True))
