"""Telegram session provisioning status enum."""

from enum import StrEnum


class TelegramSessionStatus(StrEnum):
    """Status of a Telegram session during the auto-provisioning lifecycle.

    Stored in ``provisioned_number.telegram_session_status``.
    """

    PENDING = "pending"
    CODE_SENT = "code_sent"
    VERIFIED = "verified"
    FAILED = "failed"
