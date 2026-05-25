import os
import re
from functools import lru_cache
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PYPROJECT_PATH = PROJECT_ROOT / "pyproject.toml"
_READ_VERSION_PATTERN = re.compile(r'^version\s*=\s*"([^"]+)"', re.MULTILINE)
_WRITE_VERSION_PATTERN = re.compile(r'^(version\s*=\s*")([^"]+)(")', re.MULTILINE)


def _parse_version(version: str) -> tuple[int, int, int]:
    parts = version.split(".")
    if len(parts) != 3 or not all(part.isdigit() for part in parts):
        raise ValueError(f"Expected semver X.Y.Z, got {version!r}")
    return int(parts[0]), int(parts[1]), int(parts[2])


def bump_version(current: str, part: str) -> str:
    major, minor, patch = _parse_version(current)
    if part == "major":
        return f"{major + 1}.0.0"
    if part == "minor":
        return f"{major}.{minor + 1}.0"
    if part == "patch":
        return f"{major}.{minor}.{patch + 1}"
    raise ValueError(f"Unsupported version part {part!r}; expected one of: 'major', 'minor', 'patch'")


def bump_pyproject_version(part: str) -> str:
    text = PYPROJECT_PATH.read_text(encoding="utf-8")
    match = _WRITE_VERSION_PATTERN.search(text)
    if not match:
        raise RuntimeError(f'Could not find version in {PYPROJECT_PATH}')

    current = match.group(2)
    new_version = bump_version(current, part)
    updated = _WRITE_VERSION_PATTERN.sub(rf"\g<1>{new_version}\g<3>", text, count=1)
    PYPROJECT_PATH.write_text(updated, encoding="utf-8")
    get_app_version.cache_clear()
    return new_version


@lru_cache(maxsize=1)
def get_app_version() -> str:
    """Return the app version from APP_VERSION or pyproject.toml."""
    override = os.getenv("APP_VERSION", "").strip()
    if override:
        return override

    text = PYPROJECT_PATH.read_text(encoding="utf-8")
    match = _READ_VERSION_PATTERN.search(text)
    if not match:
        raise RuntimeError(f'Could not find version in {PYPROJECT_PATH}')
    return match.group(1)
