"""
Pure stateless helper — extract Telegram verification codes from SMS text.
"""

import re


def extract_telegram_code(sms_body: str) -> str | None:
    """Extract a Telegram verification code from an SMS body.

    Telegram codes are typically 5-6 digits. The SMS body looks like:
    'Telegram code: 12345' or similar.

    Returns:
        The extracted code string, or None if no code found.
    """
    # Try specific Telegram pattern first
    match = re.search(r"(?:code|Code)[:\s]+(\d{5,6})", sms_body)
    if match:
        return match.group(1)

    # Fallback: any 5-6 digit number
    match = re.search(r"\b(\d{5,6})\b", sms_body)
    if match:
        return match.group(1)

    return None


def derive_country_code(phone_number: str) -> str:
    """Derive a 2-letter ISO country code from an E.164 phone number.

    Simple prefix-based mapping; defaults to 'US'.
    """
    if not phone_number.startswith("+"):
        return "US"

    prefixes = [
        ("AU", "+61"),
        ("GB", "+44"),
        ("US", "+1"),
        ("CA", "+1"),
        ("NZ", "+64"),
        ("IN", "+91"),
        ("DE", "+49"),
        ("FR", "+33"),
    ]
    for cc, prefix in prefixes:
        if phone_number.startswith(prefix):
            return cc
    return "US"
