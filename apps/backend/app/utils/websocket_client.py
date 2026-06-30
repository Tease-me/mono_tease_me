from __future__ import annotations

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect, WebSocketState

_CLIENT_WS_CLOSE_CLASS_NAMES = frozenset(
    {
        "ConnectionClosed",
        "ConnectionClosedOK",
        "ConnectionClosedError",
    }
)


def is_client_websocket_disconnect(exc: BaseException) -> bool:
    if isinstance(exc, WebSocketDisconnect):
        return True

    if exc.__class__.__name__ in _CLIENT_WS_CLOSE_CLASS_NAMES:
        return True

    return isinstance(exc, RuntimeError) and "WebSocket is not connected" in str(exc)


def is_websocket_connected(ws: WebSocket) -> bool:
    return ws.client_state == WebSocketState.CONNECTED


async def safe_send_websocket_json(ws: WebSocket, payload: dict) -> bool:
    if not is_websocket_connected(ws):
        return False

    try:
        await ws.send_json(payload)
        return True
    except Exception as exc:
        if is_client_websocket_disconnect(exc):
            return False
        return False


async def safe_close_websocket(ws: WebSocket, *, code: int = 1000) -> None:
    if not is_websocket_connected(ws):
        return

    try:
        await ws.close(code=code)
    except Exception:
        pass
