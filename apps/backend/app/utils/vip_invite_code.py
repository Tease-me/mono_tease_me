"""Six-character VIP invite codes for MJ Promoter preregistration."""

import secrets
from datetime import timedelta

VIP_INVITE_CODE_LENGTH = 6
VIP_INVITE_TTL = timedelta(days=2)
# Uppercase letters and digits, excluding ambiguous I, O, 0, 1.
VIP_INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_vip_invite_code(length: int = VIP_INVITE_CODE_LENGTH) -> str:
    """Return a random uppercase alphanumeric invite code."""
    return "".join(
        secrets.choice(VIP_INVITE_CODE_ALPHABET) for _ in range(length)
    )


def normalize_vip_invite_code(code: str) -> str:
    """Normalize user input for lookup (strip whitespace, uppercase)."""
    return code.strip().upper()


def is_vip_invite_code(token: str | None) -> bool:
    """True when ``token`` is an unredeemed six-character VIP invite code."""
    if not token or not isinstance(token, str):
        return False
    normalized = normalize_vip_invite_code(token)
    return (
        len(normalized) == VIP_INVITE_CODE_LENGTH
        and all(char in VIP_INVITE_CODE_ALPHABET for char in normalized)
    )
