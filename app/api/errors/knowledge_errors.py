"""Domain errors for knowledge sync orchestration."""


class KnowledgeError(Exception):
    """Base knowledge feature exception."""


class KnowledgeValidationError(KnowledgeError):
    """Raised when request/input validation fails."""


class KnowledgeNotFoundError(KnowledgeError):
    """Raised when requested knowledge does not exist."""


class KnowledgeSyncError(KnowledgeError):
    """Raised when remote ElevenLabs sync fails."""


class KnowledgePersistenceError(KnowledgeError):
    """Raised when local database persistence fails."""
