from __future__ import annotations

import logging

_PROVIDER_UNAVAILABLE_STATUS_CODES = frozenset({412, 429, 503})
_PROVIDER_UNAVAILABLE_MARKERS = (
    "failed-precondition",
    "model unavailable",
)


def is_llm_provider_unavailable(exc: BaseException) -> bool:
    status_code = getattr(exc, "status_code", None)
    if isinstance(status_code, int) and status_code in _PROVIDER_UNAVAILABLE_STATUS_CODES:
        return True

    message = str(exc).lower()
    return any(marker in message for marker in _PROVIDER_UNAVAILABLE_MARKERS)


def log_fact_extraction_failure(
    logger: logging.Logger,
    message: str,
    exc: Exception,
    **context: object,
) -> None:
    suffix = " ".join(f"{key}={value}" for key, value in context.items())
    detail = f"{suffix} " if suffix else ""

    if is_llm_provider_unavailable(exc):
        logger.warning(
            "%s provider_unavailable %serr=%s",
            message,
            detail,
            exc,
        )
        return

    logger.warning("%s failed %serr=%s", message, detail, exc)
