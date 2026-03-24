"""Use-case orchestration for admin logs APIs."""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import re
import asyncio
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from app.core.config import settings
from app.core.live_logs import get_latest_event_id, get_live_events_after
from app.services.repositories.admin_logs_repository import (
    RepoLogFileMeta,
    list_allowed_log_files,
    read_file_lines,
    resolve_log_file,
)

log = logging.getLogger(__name__)

LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
LogDirection = Literal["backward", "forward"]

_PROD_RE = re.compile(r'^ts=(?P<ts>.+?) level=(?P<level>[A-Z]+) logger=(?P<logger>.+?) msg="(?P<msg>.*)"$')
_LOCAL_RE = re.compile(r"^(?P<ts>\d{4}-\d{2}-\d{2} [^ ]+) (?P<level>[A-Z]+) (?P<logger>[^:]+): (?P<msg>.*)$")
_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_JWT_RE = re.compile(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b")
_BEARER_RE = re.compile(r"(?i)\b(bearer\s+)[A-Za-z0-9\-._~+/]+=*")
_SECRET_RE = re.compile(r"(?i)\b(api[_-]?key|token|secret|password)\b\s*[:=]\s*([A-Za-z0-9\-._~+/=]{8,})")


class AdminLogsValidationError(Exception):
    """Raised when logs API inputs are invalid."""


class AdminLogsAccessError(Exception):
    """Raised when requested log resource cannot be accessed."""


@dataclass(slots=True)
class LogLineItem:
    ts: str | None
    level: str | None
    logger: str | None
    message: str
    raw: str
    file: str
    line_no: int

    def as_dict(self) -> dict:
        return {
            "ts": self.ts,
            "level": self.level,
            "logger": self.logger,
            "message": self.message,
            "raw": self.raw,
            "file": self.file,
            "line_no": self.line_no,
        }


@dataclass(slots=True)
class LogFileMeta:
    name: str
    size_bytes: int
    modified_at: str
    is_current: bool

    def as_dict(self) -> dict:
        return {
            "name": self.name,
            "size_bytes": self.size_bytes,
            "modified_at": self.modified_at,
            "is_current": self.is_current,
        }


@dataclass(slots=True)
class AdminLogsPageResult:
    ok: bool
    items: list[LogLineItem]
    next_cursor: str | None
    prev_cursor: str | None
    applied_filters: dict
    redaction_applied: bool

    def as_dict(self) -> dict:
        return {
            "ok": self.ok,
            "items": [item.as_dict() for item in self.items],
            "next_cursor": self.next_cursor,
            "prev_cursor": self.prev_cursor,
            "applied_filters": self.applied_filters,
            "redaction_applied": self.redaction_applied,
        }


@dataclass(slots=True)
class AdminLogFilesResult:
    ok: bool
    files: list[LogFileMeta]

    def as_dict(self) -> dict:
        return {"ok": self.ok, "files": [f.as_dict() for f in self.files]}


@dataclass(slots=True)
class AdminLogDownloadResult:
    file_name: str
    file_path: Path
    size_bytes: int


def _redact_text(value: str) -> str:
    redacted = _EMAIL_RE.sub("[REDACTED_EMAIL]", value)
    redacted = _JWT_RE.sub("[REDACTED_JWT]", redacted)
    redacted = _BEARER_RE.sub(r"\1[REDACTED_TOKEN]", redacted)
    redacted = _SECRET_RE.sub(lambda m: f"{m.group(1)}=[REDACTED_SECRET]", redacted)
    return redacted


def _parse_line(line: str) -> tuple[str | None, str | None, str | None, str]:
    prod = _PROD_RE.match(line)
    if prod:
        return prod.group("ts"), prod.group("level"), prod.group("logger"), prod.group("msg")
    local = _LOCAL_RE.match(line)
    if local:
        return local.group("ts"), local.group("level"), local.group("logger"), local.group("msg")
    return None, None, None, line


def _filters_hash(filters: dict) -> str:
    raw = json.dumps(filters, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _encode_cursor(position: int, direction: LogDirection, filters_hash: str) -> str:
    payload = {"p": position, "d": direction, "h": filters_hash}
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def _decode_cursor(cursor: str) -> dict:
    padding = "=" * (-len(cursor) % 4)
    try:
        data = base64.urlsafe_b64decode((cursor + padding).encode("utf-8"))
        payload = json.loads(data.decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise AdminLogsValidationError("Invalid cursor") from exc
    if not isinstance(payload, dict):
        raise AdminLogsValidationError("Invalid cursor")
    return payload


def _validate_level(level: str | None) -> str | None:
    if level is None:
        return None
    normalized = level.strip().upper()
    allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
    if normalized not in allowed:
        raise AdminLogsValidationError("Invalid level filter")
    return normalized


def _validate_limit(limit: int) -> int:
    if limit < 1 or limit > 1000:
        raise AdminLogsValidationError("limit must be between 1 and 1000")
    return limit


def _validate_poll_interval_ms(poll_interval_ms: int) -> int:
    if poll_interval_ms < 250 or poll_interval_ms > 15000:
        raise AdminLogsValidationError("poll_interval_ms must be between 250 and 15000")
    return poll_interval_ms


def _repo_to_log_file_meta(item: RepoLogFileMeta) -> LogFileMeta:
    modified = datetime.fromtimestamp(item.modified_at, tz=timezone.utc).isoformat()
    return LogFileMeta(
        name=item.name,
        size_bytes=item.size_bytes,
        modified_at=modified,
        is_current=item.is_current,
    )


def get_log_files() -> AdminLogFilesResult:
    log.info("admin_logs_files_read_start")
    try:
        files = list_allowed_log_files(settings.LOG_FILE_PATH)
        result = AdminLogFilesResult(ok=True, files=[_repo_to_log_file_meta(f) for f in files])
        log.info("admin_logs_files_read_done count=%s", len(result.files))
        return result
    except Exception as exc:  # noqa: BLE001
        log.error("admin_logs_files_read_failed err=%s", exc, exc_info=True)
        raise


def get_log_download(file_name: str) -> AdminLogDownloadResult:
    try:
        path = resolve_log_file(settings.LOG_FILE_PATH, file_name)
    except ValueError as exc:
        raise AdminLogsValidationError(str(exc)) from exc
    except FileNotFoundError as exc:
        raise AdminLogsAccessError(str(exc)) from exc

    size = path.stat().st_size
    log.info("admin_logs_download file=%s size_bytes=%s", file_name, size)
    return AdminLogDownloadResult(file_name=file_name, file_path=path, size_bytes=size)


def get_logs_page(
    *,
    q: str | None = None,
    level: str | None = None,
    file: str | None = None,
    limit: int = 200,
    cursor: str | None = None,
    direction: LogDirection = "backward",
) -> AdminLogsPageResult:
    try:
        level_value = _validate_level(level)
        limit_value = _validate_limit(limit)
        direction_value: LogDirection = "forward" if direction == "forward" else "backward"

        file_metas = list_allowed_log_files(settings.LOG_FILE_PATH)
        if file:
            try:
                selected_path = resolve_log_file(settings.LOG_FILE_PATH, file)
            except ValueError as exc:
                raise AdminLogsValidationError(str(exc)) from exc
            except FileNotFoundError as exc:
                raise AdminLogsAccessError(str(exc)) from exc
            file_metas = [item for item in file_metas if item.path == selected_path]

        filters = {
            "q": q or "",
            "level": level_value or "",
            "file": file or "",
            "direction": direction_value,
        }
        fhash = _filters_hash(filters)
        start_pos = 0
        if cursor:
            payload = _decode_cursor(cursor)
            if payload.get("h") != fhash or payload.get("d") != direction_value:
                raise AdminLogsValidationError("Cursor does not match current filters")
            try:
                start_pos = int(payload.get("p", 0))
            except Exception as exc:  # noqa: BLE001
                raise AdminLogsValidationError("Invalid cursor position") from exc
            if start_pos < 0:
                raise AdminLogsValidationError("Invalid cursor position")

        log.info(
            "admin_logs_read_start file=%s q=%s level=%s limit=%s direction=%s cursor=%s",
            file,
            bool(q),
            level_value,
            limit_value,
            direction_value,
            bool(cursor),
        )

        collected: list[LogLineItem] = []
        for meta in file_metas:
            lines = read_file_lines(meta.path)
            for idx, raw_line in enumerate(lines, start=1):
                ts, parsed_level, logger_name, message = _parse_line(raw_line)
                if level_value and (parsed_level or "").upper() != level_value:
                    continue
                if q and q.lower() not in raw_line.lower():
                    continue
                redacted_raw = _redact_text(raw_line)
                redacted_message = _redact_text(message)
                collected.append(
                    LogLineItem(
                        ts=ts,
                        level=parsed_level,
                        logger=logger_name,
                        message=redacted_message,
                        raw=redacted_raw,
                        file=meta.name,
                        line_no=idx,
                    )
                )

        ordered = list(reversed(collected)) if direction_value == "backward" else collected
        page_items = ordered[start_pos : start_pos + limit_value]

        next_cursor: str | None = None
        prev_cursor: str | None = None
        end_pos = start_pos + len(page_items)
        if end_pos < len(ordered):
            next_cursor = _encode_cursor(end_pos, direction_value, fhash)
        if start_pos > 0:
            prev_start = max(0, start_pos - limit_value)
            prev_cursor = _encode_cursor(prev_start, direction_value, fhash)

        log.info(
            "admin_logs_read_done total=%s returned=%s next=%s prev=%s",
            len(ordered),
            len(page_items),
            bool(next_cursor),
            bool(prev_cursor),
        )
        return AdminLogsPageResult(
            ok=True,
            items=page_items,
            next_cursor=next_cursor,
            prev_cursor=prev_cursor,
            applied_filters={
                "q": q,
                "level": level_value,
                "file": file,
                "limit": limit_value,
                "direction": direction_value,
            },
            redaction_applied=True,
        )
    except (AdminLogsValidationError, AdminLogsAccessError):
        raise
    except Exception as exc:  # noqa: BLE001
        log.error("admin_logs_read_failed err=%s", exc, exc_info=True)
        raise


def stream_logs_sse(
    *,
    q: str | None = None,
    level: str | None = None,
    file: str | None = None,
    poll_interval_ms: int = 1500,
) -> AsyncIterator[str]:
    level_value = _validate_level(level)
    poll_interval_value = _validate_poll_interval_ms(poll_interval_ms)
    if file and Path(file).name != file:
        raise AdminLogsValidationError("Invalid file filter")

    async def _stream() -> AsyncIterator[str]:
        log.info(
            "admin_logs_stream_start source=live file=%s q=%s level=%s poll_interval_ms=%s",
            file,
            bool(q),
            level_value,
            poll_interval_value,
        )
        last_event_id = get_latest_event_id()
        yield "event: connected\ndata: {\"ok\":true}\n\n"

        try:
            while True:
                emitted = 0
                events = get_live_events_after(last_event_id, limit=1000)
                for event in events:
                    raw_line = event["raw"]
                    level_name = event["level"]
                    source_file = event["file"]
                    if level_value and str(level_name).upper() != level_value:
                        continue
                    if q and q.lower() not in str(raw_line).lower():
                        continue
                    if file and source_file != file:
                        continue

                    item = LogLineItem(
                        ts=event["ts"],
                        level=event["level"],
                        logger=event["logger"],
                        message=_redact_text(event["message"]),
                        raw=_redact_text(raw_line),
                        file=source_file,
                        line_no=int(event["line_no"]),
                    )
                    yield f"event: log\ndata: {json.dumps(item.as_dict(), separators=(',', ':'))}\n\n"
                    emitted += 1
                    last_event_id = int(event["id"])

                if emitted == 0:
                    yield ": keep-alive\n\n"
                await asyncio.sleep(poll_interval_value / 1000)
        except asyncio.CancelledError:
            log.info("admin_logs_stream_cancelled")
            raise
        except Exception as exc:  # noqa: BLE001
            log.error("admin_logs_stream_failed err=%s", exc, exc_info=True)
            raise
        finally:
            log.info("admin_logs_stream_done")

    return _stream()
