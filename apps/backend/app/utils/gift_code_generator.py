"""Random promo code generation for first-deposit gifts."""

import secrets

GIFT_CODE_LENGTH = 6
GIFT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_gift_code(length: int = GIFT_CODE_LENGTH) -> str:
    """Return a random uppercase alphanumeric gift code."""
    return "".join(secrets.choice(GIFT_CODE_ALPHABET) for _ in range(length))


def normalize_gift_code(code: str) -> str:
    """Normalize user input for lookup (strip whitespace, uppercase)."""
    return code.strip().upper()
