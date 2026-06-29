"""add character stage video candidates table

Revision ID: l5m6n7o8p9q0
Revises: k4l5m6n7o8p9
Create Date: 2026-06-23 14:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "l5m6n7o8p9q0"
down_revision: Union[str, Sequence[str], None] = "k4l5m6n7o8p9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "character_stage_video_candidates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("influencer_id", sa.String(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("stage_index", sa.Integer(), nullable=False),
        sa.Column("source_image_key", sa.String(), nullable=False),
        sa.Column("generation_prompt", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("generated_poster_key", sa.String(), nullable=True),
        sa.Column("generated_mp4_key", sa.String(), nullable=True),
        sa.Column("assigned_variant_index", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("grok_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["adult_characters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["influencer_id"], ["influencers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_character_stage_video_candidates_lookup",
        "character_stage_video_candidates",
        ["influencer_id", "character_id", "stage_index"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_character_stage_video_candidates_lookup",
        table_name="character_stage_video_candidates",
    )
    op.drop_table("character_stage_video_candidates")
