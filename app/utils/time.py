import json
import logging
import random
import re
from datetime import datetime, timezone
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import prompt_keys
from app.services.system_prompt_service import get_system_prompt

log = logging.getLogger(__name__)

_TIME_RANGE_RE = re.compile(r"^\s*(\d{1,2})\s*(AM|PM)\s*-\s*(\d{1,2})\s*(AM|PM)\s*$", re.IGNORECASE)


def resolve_timezone(tz_name: str | None):
    if not tz_name:
        return timezone.utc
    try:
        return ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        return timezone.utc


def is_weekend(user_timezone: str | None) -> bool:
    tz = resolve_timezone(user_timezone)
    now = datetime.now(tz)
    return now.weekday() >= 5


def format_timezone_location(tz_name: str | None) -> str:
    if not tz_name:
        return "UTC"

    cleaned = tz_name.strip()
    if not cleaned:
        return "UTC"

    upper = cleaned.upper()
    if upper in {"UTC", "GMT"}:
        return upper

    parts = [part.replace("_", " ") for part in cleaned.split("/") if part]
    if not parts:
        return "UTC"
    if len(parts) == 1:
        return parts[0]

    location = parts[-1]
    region = ", ".join(parts[:-1])
    return f"{location} ({region})"


def _hour_from_12h(hour: int, meridiem: str) -> int:
    hour = hour % 12
    if meridiem.upper() == "PM":
        hour += 12
    return hour


def range_span(start: int, end: int) -> int:
    if start <= end:
        return end - start + 1
    return (24 - start) + (end + 1)


def hour_in_range(hour: int, start: int, end: int) -> bool:
    if start <= end:
        return start <= hour <= end
    return hour >= start or hour <= end


def parse_time_range(label: str):
    match = _TIME_RANGE_RE.match(label or "")
    if not match:
        return None
    start_raw, start_ampm, end_raw, end_ampm = match.groups()
    start = _hour_from_12h(int(start_raw), start_ampm)
    end = _hour_from_12h(int(end_raw), end_ampm)
    return (start, end)