"""add character stage videos table

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-06-23 12:30:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "k4l5m6n7o8p9"
down_revision: Union[str, Sequence[str], None] = "j3k4l5m6n7o8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "character_stage_videos",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("influencer_id", sa.String(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("stage_index", sa.Integer(), nullable=False),
        sa.Column("variant_index", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=256), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("stage_context", sa.Text(), nullable=True),
        sa.Column("scene_description", sa.Text(), nullable=True),
        sa.Column("mp4_key", sa.String(), nullable=True),
        sa.Column("webm_key", sa.String(), nullable=True),
        sa.Column("poster_key", sa.String(), nullable=True),
        sa.Column("stage_context_embedding", Vector(1536), nullable=True),
        sa.Column("scene_description_embedding", Vector(1536), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["character_id"], ["adult_characters.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["influencer_id"], ["influencers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "influencer_id",
            "character_id",
            "stage_index",
            "variant_index",
            name="uq_character_stage_video_slot",
        ),
    )
    op.create_index(
        "ix_character_stage_videos_influencer_character",
        "character_stage_videos",
        ["influencer_id", "character_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_character_stage_videos_influencer_character", table_name="character_stage_videos")
    op.drop_table("character_stage_videos")
