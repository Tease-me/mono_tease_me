"""add missing influencer_knowledge_chunks table

Revision ID: m6n7o8p9q0r1
Revises: l5m6n7o8p9q0
Create Date: 2026-06-24 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision: str = "m6n7o8p9q0r1"
down_revision: Union[str, Sequence[str], None] = "l5m6n7o8p9q0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "influencer_knowledge_chunks" in inspector.get_table_names():
        return

    op.create_table(
        "influencer_knowledge_chunks",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("influencer_id", sa.String(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["document_id"],
            ["influencer_knowledge_documents.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["influencer_id"],
            ["influencers.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_influencer_knowledge_chunks_document_id"),
        "influencer_knowledge_chunks",
        ["document_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_influencer_knowledge_chunks_influencer_id"),
        "influencer_knowledge_chunks",
        ["influencer_id"],
        unique=False,
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "influencer_knowledge_chunks" not in inspector.get_table_names():
        return

    op.drop_index(
        op.f("ix_influencer_knowledge_chunks_influencer_id"),
        table_name="influencer_knowledge_chunks",
    )
    op.drop_index(
        op.f("ix_influencer_knowledge_chunks_document_id"),
        table_name="influencer_knowledge_chunks",
    )
    op.drop_table("influencer_knowledge_chunks")
