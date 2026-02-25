"""Influencer knowledge base models for chat RAG."""

from datetime import datetime, timezone
from typing import TYPE_CHECKING

from pgvector.sqlalchemy import Vector
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .influencer import Influencer


class InfluencerKnowledgeDocument(Base):
    """Single source-of-truth knowledge document per influencer."""

    __tablename__ = "influencer_knowledge_documents"
    __table_args__ = (
        UniqueConstraint("influencer_id", name="uq_influencer_knowledge_documents_influencer_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    influencer_id: Mapped[str] = mapped_column(
        ForeignKey("influencers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    raw_text: Mapped[str] = mapped_column(Text, nullable=False)
    text_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    influencer: Mapped["Influencer"] = relationship()
    chunks: Mapped[list["InfluencerKnowledgeChunk"]] = relationship(
        back_populates="document",
        cascade="all, delete-orphan",
    )


class InfluencerKnowledgeChunk(Base):
    """Vectorized knowledge chunks for semantic retrieval."""

    __tablename__ = "influencer_knowledge_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    document_id: Mapped[int] = mapped_column(
        ForeignKey("influencer_knowledge_documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    influencer_id: Mapped[str] = mapped_column(
        ForeignKey("influencers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(Vector(1536), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    document: Mapped["InfluencerKnowledgeDocument"] = relationship(back_populates="chunks")
    influencer: Mapped["Influencer"] = relationship()


class InfluencerKnowledgeSync(Base):
    """Maps influencer knowledge to ElevenLabs knowledge document ids."""

    __tablename__ = "influencer_knowledge_sync"

    influencer_id: Mapped[str] = mapped_column(
        ForeignKey("influencers.id", ondelete="CASCADE"),
        primary_key=True,
    )
    eleven_document_id: Mapped[str] = mapped_column(String, nullable=False)
    eleven_document_name: Mapped[str | None] = mapped_column(String, nullable=True)
    eleven_document_type: Mapped[str] = mapped_column(String, nullable=False, default="text")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    influencer: Mapped["Influencer"] = relationship()
