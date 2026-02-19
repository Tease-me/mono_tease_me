# FastAPI API Call Logging Guide

## Goal and Architecture

This guide translates the current Django logging approach in this repository into a production-ready FastAPI implementation.

Log these events:
- Inbound API calls (client -> FastAPI)
- Outbound API calls (FastAPI -> external services)
- Unhandled errors and timeout/failure conditions

Why:
- Auditability (who called what, when)
- Faster debugging (status/latency/body context)
- Incident response (correlated inbound/outbound traces)

Current repo mapping used as source:
- Inbound request middleware pattern: `chatbot_project/middlewares/request_logging.py`
- File handler + logger wiring pattern: `chatbot_project/settings/base.py`
- Outbound API call pattern: `sap/services/ai/api_manager.py`

## Logging Data Model (Structured JSON)

Use a JSON formatter and emit one JSON object per log event.

### Inbound event schema

Required fields:
- `timestamp`
- `level`
- `event` (example: `inbound_request`)
- `request_id`
- `method`
- `path`
- `status_code`
- `duration_ms`
- `actor`

Optional fields:
- `query`
- `client_ip`
- `user_agent`
- `masked_body`
- `error`

Example:

```json
{
  "timestamp": "2026-02-19T12:34:56.123Z",
  "level": "INFO",
  "event": "inbound_request",
  "request_id": "2a8a2261-bb73-41ad-bca2-0d6fcd69a533",
  "method": "POST",
  "path": "/v1/messages",
  "query": "",
  "status_code": 200,
  "duration_ms": 38.44,
  "client_ip": "10.0.0.8",
  "user_agent": "Mozilla/5.0",
  "actor": "user:42",
  "masked_body": {
    "member_id": 42,
    "password": "***"
  }
}
```

### Outbound event schema

Required fields:
- `timestamp`
- `level`
- `event` (example: `outbound_api_call`)
- `request_id`
- `target_service`
- `http_method`
- `url`
- `duration_ms`

Optional fields:
- `status_code`
- `masked_payload`
- `error`

Example:

```json
{
  "timestamp": "2026-02-19T12:34:56.321Z",
  "level": "INFO",
  "event": "outbound_api_call",
  "request_id": "2a8a2261-bb73-41ad-bca2-0d6fcd69a533",
  "target_service": "joker_api",
  "http_method": "GET",
  "url": "https://api.example.com/Wallet/Balance",
  "status_code": 200,
  "duration_ms": 104.91,
  "masked_payload": {
    "MemberId": 42,
    "Hash": "***"
  },
  "error": null
}
```

### Redaction policy

Default sensitive keys:
- `password`
- `token`
- `access`
- `refresh`
- `secret`
- `authorization`
- `api_key`

Mask by key-name match (case-insensitive, substring match) in nested dict/list structures.

## FastAPI Implementation

## 1) Shared helpers

```python
# app/logging_helpers.py
from __future__ import annotations

from typing import Any

SENSITIVE_KEYS = {
    "password", "token", "access", "refresh", "secret", "authorization", "api_key"
}

def mask_sensitive(data: Any) -> Any:
    if isinstance(data, dict):
        masked = {}
        for k, v in data.items():
            key_l = k.lower()
            if any(s in key_l for s in SENSITIVE_KEYS):
                masked[k] = "***"
            else:
                masked[k] = mask_sensitive(v)
        return masked
    if isinstance(data, list):
        return [mask_sensitive(item) for item in data]
    return data
```

```python
# app/auth_helpers.py
from fastapi import Request

def get_actor(request: Request) -> str:
    # Replace with your auth integration (JWT/session/API-key lookup).
    user = getattr(request.state, "user", None)
    if user and getattr(user, "id", None):
        return f"user:{user.id}"

    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("api-key "):
        return "api_key"

    return "anonymous"
```

## 2) Correlation ID + inbound logging middleware

```python
# app/middleware/request_logging.py
from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.auth_helpers import get_actor
from app.logging_helpers import mask_sensitive

logger = logging.getLogger("api")

MAX_LOG_BODY_BYTES = 1_000_000  # 1MB safety cap

class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        started = time.perf_counter()
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        request.state.request_id = request_id

        raw_body: bytes = b""
        masked_body: Any = "<empty>"

        try:
            raw_body = await request.body()
            if len(raw_body) > MAX_LOG_BODY_BYTES:
                masked_body = "<body too large>"
            elif request.method in {"POST", "PUT", "PATCH"} and raw_body:
                try:
                    masked_body = mask_sensitive(json.loads(raw_body.decode("utf-8")))
                except Exception:
                    masked_body = "<invalid or non-json body>"

            response = await call_next(request)
        except Exception as exc:
            duration_ms = round((time.perf_counter() - started) * 1000, 2)
            logger.exception(
                "inbound_request_error",
                extra={
                    "event": "inbound_request_error",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "query": request.url.query,
                    "status_code": 500,
                    "duration_ms": duration_ms,
                    "client_ip": request.client.host if request.client else None,
                    "user_agent": request.headers.get("user-agent"),
                    "actor": get_actor(request),
                    "masked_body": masked_body,
                    "error": exc.__class__.__name__,
                },
            )
            raise

        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        response.headers["X-Request-ID"] = request_id

        logger.info(
            "inbound_request",
            extra={
                "event": "inbound_request",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "query": request.url.query,
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "client_ip": request.client.host if request.client else None,
                "user_agent": request.headers.get("user-agent"),
                "actor": get_actor(request),
                "masked_body": masked_body,
            },
        )
        return response
```

Register it:

```python
# app/main.py
from fastapi import FastAPI
from app.middleware.request_logging import RequestLoggingMiddleware

app = FastAPI()
app.add_middleware(RequestLoggingMiddleware)
```

## 3) Outbound API logging wrapper

```python
# app/http_client.py
from __future__ import annotations

import logging
import time
from typing import Any, Optional

import httpx

from app.logging_helpers import mask_sensitive

logger = logging.getLogger("api")

async def log_outbound_call(
    *,
    client: httpx.AsyncClient,
    method: str,
    url: str,
    request_id: str,
    target_service: str,
    json_payload: Optional[dict[str, Any]] = None,
    timeout: float = 10.0,
) -> httpx.Response:
    started = time.perf_counter()
    headers = {"X-Request-ID": request_id}

    try:
        response = await client.request(
            method=method,
            url=url,
            json=json_payload,
            headers=headers,
            timeout=timeout,
        )
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        logger.info(
            "outbound_api_call",
            extra={
                "event": "outbound_api_call",
                "request_id": request_id,
                "target_service": target_service,
                "http_method": method.upper(),
                "url": str(url),
                "status_code": response.status_code,
                "duration_ms": duration_ms,
                "masked_payload": mask_sensitive(json_payload or {}),
                "error": None,
            },
        )
        response.raise_for_status()
        return response
    except Exception as exc:
        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        logger.error(
            "outbound_api_call_error",
            extra={
                "event": "outbound_api_call_error",
                "request_id": request_id,
                "target_service": target_service,
                "http_method": method.upper(),
                "url": str(url),
                "duration_ms": duration_ms,
                "masked_payload": mask_sensitive(json_payload or {}),
                "error": exc.__class__.__name__,
            },
        )
        raise
```

Usage in route/service:

```python
async with httpx.AsyncClient() as client:
    response = await log_outbound_call(
        client=client,
        method="GET",
        url="https://api.example.com/Wallet/Balance",
        request_id=request.state.request_id,
        target_service="joker_api",
        json_payload={"member_id": 42, "token": "abc"},
    )
```

## 4) Exception handling notes

- Do not swallow framework exceptions in middleware.
- Log context, then re-raise.
- If you use global exception handlers, ensure they preserve `X-Request-ID`.

## Logging Configuration

Use JSON formatting plus console + rotating file handlers.

```python
# app/logging_config.py
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from logging.handlers import TimedRotatingFileHandler

LOG_DIR = os.getenv("LOG_DIR", "logs")
os.makedirs(LOG_DIR, exist_ok=True)

class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for key in (
            "event", "request_id", "method", "path", "query", "status_code",
            "duration_ms", "client_ip", "user_agent", "actor",
            "target_service", "http_method", "url", "masked_body",
            "masked_payload", "error"
        ):
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        return json.dumps(payload, ensure_ascii=False)

def configure_logging() -> None:
    formatter = JsonFormatter()

    console = logging.StreamHandler()
    console.setLevel(logging.INFO)
    console.setFormatter(formatter)

    file_handler = TimedRotatingFileHandler(
        filename=os.path.join(LOG_DIR, "api.log"),
        when="midnight",
        interval=1,
        backupCount=int(os.getenv("LOG_BACKUP_DAYS", "14")),
        encoding="utf-8",
    )
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)

    logger = logging.getLogger("api")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()
    logger.addHandler(console)
    logger.addHandler(file_handler)
    logger.propagate = False
```

Run once on app startup:

```python
from app.logging_config import configure_logging

configure_logging()
```

## Docker Recommendation

Mount a dedicated logs volume to persist files:

```yaml
services:
  api:
    volumes:
      - fastapi_logs:/app/logs

volumes:
  fastapi_logs:
    external: true
```

This mirrors the pattern used in this repo (`chatbot_log` volume mounted to container logs path).

## Operational Practices

- Retention defaults:
  - `dev`: 7 backups
  - `staging`: 14 backups
  - `prod`: 30 backups
- Always mask secrets and authentication artifacts.
- Enforce body-size cap for logging (`MAX_LOG_BODY_BYTES`).
- Optional high-traffic sampling:
  - log all `4xx/5xx`
  - sample `2xx` (for example, 10%)
- Keep one `request_id` across inbound and outbound logs.

Troubleshooting examples:

```bash
# follow JSON logs
tail -f logs/api.log

# show all failing outbound calls
jq 'select(.event=="outbound_api_call_error")' logs/api.log

# trace one request end-to-end
jq 'select(.request_id=="2a8a2261-bb73-41ad-bca2-0d6fcd69a533")' logs/api.log
```

## Quick Start Checklist

1. Create `logging_helpers.py`, `auth_helpers.py`, `middleware/request_logging.py`, `http_client.py`, and `logging_config.py`.
2. Add `RequestLoggingMiddleware` to FastAPI app.
3. Configure JSON logging and rotate `logs/api.log`.
4. Add outbound wrapper (`log_outbound_call`) and replace direct `httpx` calls.
5. Propagate `X-Request-ID` in responses and outbound request headers.
6. Validate masking, error logs, and correlation behavior in local/staging.
7. Mount logs directory via Docker volume in deployment.

## Validation Scenarios

1. `POST` body has `password`/`token` and logs show masked values (`***`).
2. `GET` request logs method/path/status/duration without body parsing errors.
3. Large or non-JSON body logs safe fallback (`<body too large>` or `<invalid or non-json body>`), no crash.
4. Authenticated request logs actor as user identity.
5. Anonymous/API-key request logs fallback actor.
6. Outbound success logs method/url/status/duration with same `request_id`.
7. Outbound timeout/error logs include error class and latency.
8. Inbound `X-Request-ID` is echoed in response and used by outbound wrapper.
9. Concurrent requests maintain correct per-request IDs and metadata.
10. Rotation/retention produces expected daily files and backup pruning.

## Interfaces and Contracts

Middleware contract:
- Input: FastAPI `Request`
- Output: `Response` with `X-Request-ID`

Helper signatures:
- `mask_sensitive(data: Any) -> Any`
- `get_actor(request: Request) -> str`
- `log_outbound_call(..., request_id: str, ...) -> httpx.Response`

JSON log field contract:
- Required inbound: `timestamp`, `level`, `event`, `request_id`, `method`, `path`, `status_code`, `duration_ms`, `actor`
- Required outbound: `timestamp`, `level`, `event`, `request_id`, `target_service`, `http_method`, `url`, `duration_ms`
- Optional fields documented above should be present when available.

