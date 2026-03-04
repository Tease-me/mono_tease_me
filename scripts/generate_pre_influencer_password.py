#!/usr/bin/env python3
"""Generate a password and bcrypt hash using the app's auth scheme."""

import argparse
import secrets


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Generate raw password + bcrypt hash for DB updates.",
    )
    parser.add_argument(
        "-n",
        "--nbytes",
        type=int,
        default=18,
        help="Number of random bytes before URL-safe encoding (default: 18).",
    )
    parser.add_argument(
        "--password",
        type=str,
        default=None,
        help="Optional raw password to hash. If omitted, one is generated.",
    )
    parser.add_argument(
        "--hash-only",
        action="store_true",
        help="Print only bcrypt hash.",
    )
    args = parser.parse_args()
    try:
        from passlib.context import CryptContext
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "passlib is required. Install project dependencies or run: pip install passlib[bcrypt]"
        ) from exc

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    raw_password = args.password or secrets.token_urlsafe(args.nbytes)
    hashed_password = pwd_context.hash(raw_password)

    if args.hash_only:
        print(hashed_password)
        return

    print(f"raw_password={raw_password}")
    print(f"bcrypt_hash={hashed_password}")


if __name__ == "__main__":
    main()
