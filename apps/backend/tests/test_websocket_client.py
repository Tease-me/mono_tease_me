from __future__ import annotations

from starlette.websockets import WebSocketDisconnect

from app.utils.websocket_client import is_client_websocket_disconnect


class ConnectionClosedOK(Exception):
    pass


def test_is_client_websocket_disconnect_for_starlette_disconnect() -> None:
    assert is_client_websocket_disconnect(WebSocketDisconnect(code=1000)) is True


def test_is_client_websocket_disconnect_for_connection_closed_ok() -> None:
    exc = ConnectionClosedOK(
        "received 1000 (OK) client_stop; then sent 1000 (OK) client_stop"
    )
    assert is_client_websocket_disconnect(exc) is True


def test_is_client_websocket_disconnect_for_runtime_error() -> None:
    exc = RuntimeError('WebSocket is not connected. Need to call "accept" first.')
    assert is_client_websocket_disconnect(exc) is True


def test_is_client_websocket_disconnect_for_unrelated_error() -> None:
    assert is_client_websocket_disconnect(ValueError("nope")) is False
