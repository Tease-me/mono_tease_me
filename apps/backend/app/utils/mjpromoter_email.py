"""MJ Promoter synthetic user emails (Telegram / Instagram flows without a real inbox)."""

import re

MJ_PROMOTER_PLACEHOLDER_EMAIL_PATTERN = re.compile(
    r"^(telegram-\d+|instagram-[a-z0-9._]+)@mjpromoter\.placeholder\.invalid$",
    re.IGNORECASE,
)


def is_mjpromoter_placeholder_email(email: str | None) -> bool:
    if not email or not str(email).strip():
        return False
    return bool(MJ_PROMOTER_PLACEHOLDER_EMAIL_PATTERN.match(str(email).strip()))
