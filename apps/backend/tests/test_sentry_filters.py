import httpx
from fastapi import HTTPException
from starlette.websockets import WebSocketDisconnect

from app.core.sentry import _before_send, _is_expected_upstream_unavailable


def test_is_expected_upstream_unavailable():
    assert _is_expected_upstream_unavailable(
        HTTPException(status_code=502, detail="Upstream unavailable")
    )
    assert not _is_expected_upstream_unavailable(
        HTTPException(status_code=502, detail="Armloop API is unreachable")
    )
    assert not _is_expected_upstream_unavailable(
        HTTPException(status_code=500, detail="Upstream unavailable")
    )


def test_before_send_drops_upstream_unavailable_http_exception():
    exc = HTTPException(status_code=502, detail="Upstream unavailable")
    assert _before_send({}, {"exc_info": (HTTPException, exc, None)}) is None


def test_before_send_drops_httpx_request_error():
    exc = httpx.ReadTimeout("")
    assert _before_send({}, {"exc_info": (httpx.ReadTimeout, exc, None)}) is None


def test_before_send_keeps_unexpected_errors():
    exc = HTTPException(status_code=500, detail="Unexpected failure")
    assert _before_send({}, {"exc_info": (HTTPException, exc, None)}) == {}


def test_before_send_drops_client_websocket_disconnect():
    exc = RuntimeError('WebSocket is not connected. Need to call "accept" first.')
    assert _before_send({}, {"exc_info": (RuntimeError, exc, None)}) is None


def test_before_send_drops_starlette_websocket_disconnect():
    exc = WebSocketDisconnect(code=1000)
    assert _before_send({}, {"exc_info": (WebSocketDisconnect, exc, None)}) is None
