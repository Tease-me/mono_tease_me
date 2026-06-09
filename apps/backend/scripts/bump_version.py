#!/usr/bin/env python3
"""Bump the Poetry version in pyproject.toml (patch, minor, or major)."""

from __future__ import annotations

import argparse
import sys

from app.utils.version import bump_pyproject_version


def main() -> int:
    parser = argparse.ArgumentParser(description="Bump version in pyproject.toml")
    parser.add_argument(
        "part",
        choices=("patch", "minor", "major"),
        help="Which semver segment to increment",
    )
    args = parser.parse_args()

    try:
        new_version = bump_pyproject_version(args.part)
    except (OSError, RuntimeError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1

    print(new_version)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
