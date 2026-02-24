"""add influencer knowledge rag tables

Revision ID: 8b1c2d3e4f5a
Revises: 6a2b9d1e4c3f
Create Date: 2026-02-24 20:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = "8b1c2d3e4f5a"
down_revision: Union[str, Sequence[str], None] = "6a2b9d1e4c3f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_KNOWLEDGE_SECTION = """
Knowledge context (retrieved):
{knowledge_context}
"""


def upgrade() -> None:
    op.create_table(
        "influencer_knowledge_documents",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("influencer_id", sa.String(), sa.ForeignKey("influencers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("text_hash", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("influencer_id", name="uq_influencer_knowledge_documents_influencer_id"),
    )
    op.create_index(
        "ix_influencer_knowledge_documents_influencer_id",
        "influencer_knowledge_documents",
        ["influencer_id"],
    )

    op.create_table(
        "influencer_knowledge_chunks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "document_id",
            sa.Integer(),
            sa.ForeignKey("influencer_knowledge_documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("influencer_id", sa.String(), sa.ForeignKey("influencers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_influencer_knowledge_chunks_document_id",
        "influencer_knowledge_chunks",
        ["document_id"],
    )
    op.create_index(
        "ix_influencer_knowledge_chunks_influencer_id",
        "influencer_knowledge_chunks",
        ["influencer_id"],
    )
    op.create_index(
        "ix_influencer_knowledge_chunks_document_chunk_idx",
        "influencer_knowledge_chunks",
        ["document_id", "chunk_index"],
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS influencer_knowledge_chunks_embedding_cosine_idx
        ON influencer_knowledge_chunks
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100)
        """
    )

    # Keep DB-backed BASE_SYSTEM in sync with code template for runtime prompt rendering.
    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            UPDATE system_prompts
            SET prompt = CASE
                WHEN position(:marker in prompt) > 0 THEN prompt
                WHEN position('Here is the user''s latest message for your reference only:' in prompt) > 0
                    THEN replace(
                        prompt,
                        'Here is the user''s latest message for your reference only:',
                        :section || E'\\n' || 'Here is the user''s latest message for your reference only:'
                    )
                ELSE prompt || E'\\n\\n' || :section
            END,
            updated_at = now()
            WHERE key = 'BASE_SYSTEM'
            """
        ),
        {"marker": "{knowledge_context}", "section": _KNOWLEDGE_SECTION.strip()},
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS influencer_knowledge_chunks_embedding_cosine_idx")
    op.drop_index("ix_influencer_knowledge_chunks_document_chunk_idx", table_name="influencer_knowledge_chunks")
    op.drop_index("ix_influencer_knowledge_chunks_influencer_id", table_name="influencer_knowledge_chunks")
    op.drop_index("ix_influencer_knowledge_chunks_document_id", table_name="influencer_knowledge_chunks")
    op.drop_table("influencer_knowledge_chunks")

    op.drop_index("ix_influencer_knowledge_documents_influencer_id", table_name="influencer_knowledge_documents")
    op.drop_table("influencer_knowledge_documents")

    bind = op.get_bind()
    bind.execute(
        sa.text(
            """
            UPDATE system_prompts
            SET prompt = replace(prompt, :section_with_newline, ''),
                updated_at = now()
            WHERE key = 'BASE_SYSTEM'
              AND position(:marker in prompt) > 0
            """
        ),
        {
            "marker": "{knowledge_context}",
            "section_with_newline": _KNOWLEDGE_SECTION.strip() + "\n",
        },
    )
