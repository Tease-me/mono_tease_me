import argparse
import json
import os
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

# ── Load .env from project root ──────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(PROJECT_ROOT / ".env")

WEBHOOK_SECRET = os.getenv("ELEVENLABS_CONVAI_WEBHOOK_SECRET", "")

# ── Defaults ─────────────────────────────────────────────────────────────────
DEFAULT_BASE_URL = "http://localhost:8000"
ENDPOINT = "/webhooks/memories"

# Fake but structurally valid conversation ID (change to a real one for live tests)
DEFAULT_CONVERSATION_ID = "test-conv-001"
DEFAULT_TEXT = "What do you remember about me?"


def build_payload(conversation_id: str, text: str) -> dict:
    """
    Build a payload that mirrors what ElevenLabs sends when it calls the
    `getMemory` client tool / webhook.

    ElevenLabs may send the user utterance under different keys depending on
    the integration version, so the webhook handler checks several fallbacks:
        payload.text  →  payload.input  →  payload.arguments.text
    """
    return {
        "conversation_id": conversation_id,
        "text": text,
        # Include the alternative keys so you can test fallback parsing:
        # "input": text,
        # "arguments": {"text": text},
    }


def send_request(
    base_url: str,
    payload: dict,
    token: str | None,
    timeout: float = 15.0,
) -> requests.Response:
    url = f"{base_url.rstrip('/')}{ENDPOINT}"
    headers = {"Content-Type": "application/json"}
    if token is not None:
        headers["X-Webhook-Token"] = token

    print(f"\n{'─' * 60}")
    print(f"POST  {url}")
    print(f"Token {'(set)' if token else '(none)'}")
    print(f"Payload:\n{json.dumps(payload, indent=2)}")
    print(f"{'─' * 60}\n")

    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    start = time.perf_counter()
    resp = requests.post(url, json=payload, headers=headers, timeout=timeout, verify=False)
    elapsed_ms = int((time.perf_counter() - start) * 1000)

    return resp, elapsed_ms


def print_result(resp: requests.Response, elapsed_ms: int):
    status = resp.status_code
    colour = "\033[92m" if status == 200 else "\033[91m"
    reset = "\033[0m"

    print(f"Status: {colour}{status}{reset}  ({elapsed_ms} ms)")

    try:
        body = resp.json()
    except Exception:
        print(f"Raw body: {resp.text[:500]}")
        return

    memories = body.get("memories", [])
    print(f"Memories returned: {len(memories)}\n")

    if memories:
        for i, mem in enumerate(memories, 1):
            preview = mem[:160] if isinstance(mem, str) else str(mem)[:160]
            print(f"  [{i}] {preview}")
    else:
        print("  (no memories)")

    print(f"\nFull response:\n{json.dumps(body, indent=2, default=str)}")


def main():
    parser = argparse.ArgumentParser(
        description="Simulate ElevenLabs getMemory webhook call"
    )
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE_URL,
        help=f"API base URL (default: {DEFAULT_BASE_URL})",
    )
    parser.add_argument(
        "--conversation-id",
        default=DEFAULT_CONVERSATION_ID,
        help="ElevenLabs conversation_id to look up",
    )
    parser.add_argument(
        "--text",
        default=DEFAULT_TEXT,
        help="User text to search memories for",
    )
    parser.add_argument(
        "--bad-token",
        action="store_true",
        help="Send a bogus token instead of the real secret (expect 403)",
    )
    parser.add_argument(
        "--no-token",
        action="store_true",
        help="Send no token header at all (expect 403 if secret is required)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=15.0,
        help="Request timeout in seconds (default: 15)",
    )
    args = parser.parse_args()

    # Resolve token
    if args.no_token:
        token = None
    elif args.bad_token:
        token = "bad_token_for_testing_403"
    else:
        if not WEBHOOK_SECRET:
            print(
                "⚠️  ELEVENLABS_CONVAI_WEBHOOK_SECRET not found in .env — "
                "sending request without token."
            )
        token = WEBHOOK_SECRET or None

    payload = build_payload(args.conversation_id, args.text)

    try:
        resp, elapsed_ms = send_request(
            args.base_url, payload, token, timeout=args.timeout
        )
        print_result(resp, elapsed_ms)
    except requests.ConnectionError:
        print(f"\n❌  Could not connect to {args.base_url} — is the server running?")
        sys.exit(1)
    except requests.Timeout:
        print(f"\n❌  Request timed out after {args.timeout}s")
        sys.exit(1)


if __name__ == "__main__":
    main()