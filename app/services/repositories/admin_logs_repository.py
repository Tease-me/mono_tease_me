"""Filesystem repository helpers for admin logs APIs."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class RepoLogFileMeta:
    name: str
    path: Path
    size_bytes: int
    modified_at: float
    is_current: bool


def _log_base_path(log_file_path: str) -> Path:
    return Path(log_file_path).expanduser().resolve()


def list_allowed_log_files(log_file_path: str) -> list[RepoLogFileMeta]:
    base = _log_base_path(log_file_path)
    directory = base.parent
    if not directory.exists():
        return []

    candidates: list[RepoLogFileMeta] = []
    for path in directory.iterdir():
        if not path.is_file():
            continue
        if path.name != base.name and not path.name.startswith(f"{base.name}."):
            continue
        stat = path.stat()
        candidates.append(
            RepoLogFileMeta(
                name=path.name,
                path=path,
                size_bytes=stat.st_size,
                modified_at=stat.st_mtime,
                is_current=path.name == base.name,
            )
        )

    candidates.sort(key=lambda item: item.modified_at, reverse=True)
    return candidates


def resolve_log_file(log_file_path: str, file_name: str) -> Path:
    base = _log_base_path(log_file_path)
    requested = Path(file_name)
    if requested.name != file_name:
        raise ValueError("Invalid file name")
    if file_name != base.name and not file_name.startswith(f"{base.name}."):
        raise ValueError("File is not allowed")

    target = (base.parent / file_name).resolve()
    if target.parent != base.parent:
        raise ValueError("Invalid file path")
    if not target.exists() or not target.is_file():
        raise FileNotFoundError("Log file not found")
    return target


def read_file_lines(file_path: Path) -> list[str]:
    return file_path.read_text(encoding="utf-8", errors="replace").splitlines()


def stream_log_file(file_path: Path, chunk_size: int = 65536):
    with file_path.open("rb") as fh:
        while True:
            chunk = fh.read(chunk_size)
            if not chunk:
                break
            yield chunk
