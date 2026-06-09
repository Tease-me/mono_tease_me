from __future__ import annotations

import logging
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from threading import Lock
from typing import Any


@dataclass(slots=True)
class LiveLogEvent:
    id: int
    ts: str
    level: str
    logger: str
    message: str
    raw: str
    file: str
    line_no: int


_EVENTS_MAX = 5000
_events: deque[LiveLogEvent] = deque(maxlen=_EVENTS_MAX)
_lock = Lock()
_next_id = 1


def _push_event(event: LiveLogEvent) -> None:
    with _lock:
        _events.append(event)


def append_live_log_record(record: logging.LogRecord, formatted: str) -> None:
    global _next_id
    with _lock:
        event_id = _next_id
        _next_id += 1

    ts = datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat()
    message = record.getMessage()
    file_name = record.filename or "console"
    line_no = int(record.lineno or 0)

    _push_event(
        LiveLogEvent(
            id=event_id,
            ts=ts,
            level=record.levelname,
            logger=record.name,
            message=message,
            raw=formatted,
            file=file_name,
            line_no=line_no,
        )
    )


def get_live_events_after(event_id: int, *, limit: int = 500) -> list[dict[str, Any]]:
    with _lock:
        items = [event for event in _events if event.id > event_id][:limit]
    return [
        {
            "id": event.id,
            "ts": event.ts,
            "level": event.level,
            "logger": event.logger,
            "message": event.message,
            "raw": event.raw,
            "file": event.file,
            "line_no": event.line_no,
        }
        for event in items
    ]


def get_latest_event_id() -> int:
    with _lock:
        if not _events:
            return 0
        return _events[-1].id


class LiveLogHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            formatted = self.format(record)
        except Exception:
            formatted = record.getMessage()
        append_live_log_record(record, formatted)
