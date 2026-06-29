"""add user_unlocked_stage_videos table

Revision ID: n7o8p9q0r1s2
Revises: m6n7o8p9q0r1
Create Date: 2026-06-24 14:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "n7o8p9q0r1s2"
down_revision: Union[str, Sequence[str], None] = "m6n7o8p9q0r1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_unlocked_stage_videos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("influencer_id", sa.String(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("stage_index", sa.Integer(), nullable=False),
        sa.Column("variant_index", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.String(), nullable=True),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["adult_characters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["influencer_id"], ["influencers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "influencer_id",
            "character_id",
            "stage_index",
            "variant_index",
            name="uq_user_unlocked_stage_video",
        ),
    )
    op.create_index(
        "ix_user_unlocked_stage_videos_user_influencer",
        "user_unlocked_stage_videos",
        ["user_id", "influencer_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_user_unlocked_stage_videos_user_influencer",
        table_name="user_unlocked_stage_videos",
    )
    op.drop_table("user_unlocked_stage_videos")
