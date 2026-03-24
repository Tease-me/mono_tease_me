"""Feature DTOs for knowledge sync use-cases."""

from dataclasses import dataclass


@dataclass(slots=True)
class KnowledgeUpsertInput:
    influencer_id: str
    text: str


@dataclass(slots=True)
class KnowledgeUpsertResult:
    influencer_id: str
    document_id: int
    chunk_count: int
    updated_at: str | None
    remote_document_id: str | None


@dataclass(slots=True)
class KnowledgeDeleteResult:
    influencer_id: str
    deleted: bool
