from __future__ import annotations

import logging

import pytest

from app.utils.llm_provider import is_llm_provider_unavailable, log_fact_extraction_failure


class FakeAPIStatusError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code


def test_is_llm_provider_unavailable_for_412() -> None:
    exc = FakeAPIStatusError(
        412,
        "Error code: 412 - {'code': 'failed-precondition', 'error': 'Model unavailable due to invalid state.'}",
    )
    assert is_llm_provider_unavailable(exc) is True


def test_is_llm_provider_unavailable_for_unrelated_error() -> None:
    assert is_llm_provider_unavailable(ValueError("bad prompt")) is False


def test_log_fact_extraction_failure_uses_warning_without_traceback(
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.WARNING)
    exc = FakeAPIStatusError(412, "Model unavailable")

    log_fact_extraction_failure(
        logging.getLogger("test"),
        "[cid] fact_extract",
        exc,
        chat_id="chat_1",
    )

    assert len(caplog.records) == 1
    assert caplog.records[0].levelno == logging.WARNING
    assert caplog.records[0].exc_info is None
    assert "provider_unavailable" in caplog.records[0].message
