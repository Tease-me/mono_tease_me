# Logging Guidelines

## Purpose and Scope
This document is the team standard for writing logs in this codebase.
Use it when adding or changing log statements in application code.

This guide focuses on:
- What to log
- How to format log messages
- What not to log
- How runtime logging is configured today

## Current Log Format
Current formatter behavior is defined in `app/core/logging.py`.

Local/staging format:
```text
%(asctime)s %(levelname)s %(name)s: %(message)s
```

Production format:
```text
ts=%(asctime)s level=%(levelname)s logger=%(name)s msg="%(message)s"
```

Notes:
- `env=...` is intentionally not included in per-line output.
- Logs are written to file and optionally to console.
- Rotation is time-based: daily at midnight, keep 14 backups.

## Logger Naming and Usage
- Default logger style: `log = logging.getLogger(__name__)`
- Use pre-existing named loggers only where a module already uses them (for consistency).
- Prefer parameterized logging over f-strings in hot paths.

Good:
```python
log.info("user_id=%s action=%s", user_id, action)
```

Avoid:
```python
log.info(f"user_id={user_id} action={action}")
```

## Level Guidelines
- `DEBUG`: high-volume diagnostic details for development/debugging.
- `INFO`: expected lifecycle/business events.
- `WARNING`: recoverable issues, fallback paths, degraded behavior.
- `ERROR`: operation failed and needs attention.
- `EXCEPTION`: same as error but include traceback inside `except` blocks.

## Message Style Standard
- Keep messages structured and searchable using stable key names.
- Include traceability identifiers where relevant:
  - `cid`
  - `chat_id`
  - `conversation_id`
  - `user_id`
  - `influencer_id`
- Prefer one-line logs for normal events.
- Multi-line logs are acceptable for prompt logging via the prompt helper.

Example:
```python
log.info(
    "chat_id=%s user_id=%s influencer_id=%s status=%s",
    chat_id, user_id, influencer_id, status
)
```

## Sensitive Data and Redaction Rules
Never log raw secrets or personal-sensitive fields.

Do not log:
- Access/refresh tokens
- API keys
- Passwords
- Full payment payloads
- Full PII payloads

Use safe alternatives:
- Mask or partially reveal values (`abcd...wxyz`)
- Log IDs, hashes, counts, status codes
- Log metadata, not full secret-bearing payloads

Prompt redaction helper behavior:
- Implemented in `app/utils/logging/prompt_logging.py`
- Redacts emails and JWT-like tokens before logging

## Prompt Logging Rules
- Use `app/utils/logging/prompt_logging.py::log_prompt` for prompt logs.
- Do not add ad hoc raw prompt dumps in random files.
- Prompt truncation marker is disabled; full prompt is logged by helper.
- Because prompt logs can be large and sensitive, only log when it adds clear debugging value.

## Noisy Logger Suppression Baseline
Suppression is configured in `app/core/logging.py` and currently applies to:
- `botocore`
- `boto3`
- `urllib3`
- `s3transfer`
- `httpx`
- `httpcore`
- `openai`
- `hpack`
- `hpack.hpack`

These are pinned to `WARNING` to reduce noisy debug/info logs.

## Operational Basics
Runtime logging env vars:
- `APP_ENV`
- `LOG_FILE_PATH`
- `LOG_LEVEL`
- `LOG_TO_CONSOLE`

Defaults:
- File path defaults to `./logs/app.log`
- Daily rotation at midnight
- `backupCount=14`

Useful commands:
```bash
tail -f logs/app.log
rg "chat_id=" logs/app.log
rg "conversation_id=" logs/app.log
rg "user_id=" logs/app.log
```

## Good/Bad Examples
Good:
```python
log.info("cid=%s chat_id=%s start", cid, chat_id)
```

Bad:
```python
log.info(f"cid={cid} chat_id={chat_id} start")
```

Good:
```python
log.warning("chat_id=%s fallback=redis_history reason=%s", chat_id, reason)
```

Bad:
```python
log.warning("Something went wrong")
```

Good:
```python
log.error("conversation_id=%s elevenlabs_status=%s", conversation_id, status_code)
```

Bad:
```python
log.error("Elevenlabs failed with payload=%s", full_payload_with_token)
```

Good:
```python
try:
    ...
except Exception:
    log.exception("chat_id=%s relationship_update_failed", chat_id)
```

Bad:
```python
except Exception as exc:
    log.error("Error: %s", exc)  # no traceback
```

Good:
```python
log.info("user_id=%s prompt_version=%s tokens=%s", user_id, version, token_count)
```

Bad:
```python
log.info("user=%s prompt=%s", user_id, full_unredacted_prompt_dump)
```

## Do/Don't Checklist
Do:
- Use `logging.getLogger(__name__)` by default.
- Use parameterized logging with stable keys.
- Include IDs needed to correlate events.
- Use appropriate levels (`INFO` vs `WARNING` vs `ERROR`).
- Use `log.exception(...)` in exception handlers.
- Use `log_prompt(...)` for prompt logs.

Don't:
- Log secrets, tokens, raw keys, passwords, or full sensitive payloads.
- Use noisy debug logs in production-critical hot paths.
- Use vague messages without searchable context.
- Duplicate logger setup in feature modules.
- Reintroduce `env=...` tags into message formats.
