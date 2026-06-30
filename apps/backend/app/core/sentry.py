import logging

import httpx
import sentry_sdk
from fastapi import HTTPException
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

log = logging.getLogger(__name__)


def _is_expected_upstream_unavailable(exc: BaseException) -> bool:
    return (
        isinstance(exc, HTTPException)
        and exc.status_code == 502
        and exc.detail == "Upstream unavailable"
    )


def _is_client_websocket_disconnect(exc: BaseException) -> bool:
    return isinstance(exc, RuntimeError) and "WebSocket is not connected" in str(exc)


def _before_send(event, hint):
    exc_info = hint.get("exc_info")
    if exc_info and exc_info[1] is not None:
        if _is_expected_upstream_unavailable(exc_info[1]):
            return None
        if isinstance(exc_info[1], httpx.RequestError):
            return None
        if _is_client_websocket_disconnect(exc_info[1]):
            return None

    original = hint.get("original_exception")
    if original is not None:
        if _is_expected_upstream_unavailable(original):
            return None
        if isinstance(original, httpx.RequestError):
            return None
        if _is_client_websocket_disconnect(original):
            return None

    return event


def init_sentry(
    dsn: str,
    app_env: str,
    traces_sample_rate: float,
    profiles_sample_rate: float,
    release: str | None,
    send_default_pii: bool,
) -> None:
    sentry_sdk.init(
        dsn=dsn,
        environment=app_env,
        release=release or None,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            LoggingIntegration(
                level=logging.WARNING,
                event_level=logging.ERROR,
            ),
        ],
        traces_sample_rate=traces_sample_rate,
        profiles_sample_rate=profiles_sample_rate,
        send_default_pii=send_default_pii,
        before_send=_before_send,
    )
    log.info("Sentry initialised (env=%s, traces=%.2f)", app_env, traces_sample_rate)
