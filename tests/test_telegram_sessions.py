from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

os.environ.setdefault("OPENAI_API_KEY", "test-key")

from app.api.routes.telegram_admin import router as telegram_admin_router
from app.services.gateways.telegram.handlers import TelegramMessageHandler
from app.services.gateways.telegram.session_manager import TelegramSessionManager
from app.utils.auth.dependencies import get_current_user


class FakeRedis:
    def __init__(self) -> None:
        self._values: dict[str, str] = {}

    async def set(
        self,
        key: str,
        value: str | int,
        *,
        ex: int | None = None,
        nx: bool = False,
    ) -> bool:
        if nx and key in self._values:
            return False
        self._values[key] = str(value)
        return True

    async def get(self, key: str) -> str | None:
        return self._values.get(key)


class FakeTelegramClient:
    def __init__(self, telegram_id: int, telegram_user: str = "tester") -> None:
        self.is_connected = True
        self.sent_messages: list[dict[str, str | int]] = []
        self._tease_me_telegram_id = telegram_id
        self._tease_me_telegram_user = telegram_user
        self.message_handlers: list[object] = []
        self.raw_update_handlers: list[object] = []

    async def send_message(self, *, chat_id: int, text: str) -> None:
        self.sent_messages.append({"chat_id": chat_id, "text": text})

    async def get_me(self):
        return SimpleNamespace(
            id=self._tease_me_telegram_id,
            username=self._tease_me_telegram_user,
            first_name=self._tease_me_telegram_user,
        )

    def on_message(self, _filters):
        def decorator(callback):
            self.message_handlers.append(callback)
            return callback

        return decorator

    def on_raw_update(self):
        def decorator(callback):
            self.raw_update_handlers.append(callback)
            return callback

        return decorator


class FakeResumeClient:
    me = SimpleNamespace(id=999, username="same_account", first_name="same_account")

    def __init__(self, **_: object) -> None:
        self.is_connected = True
        self.started = False
        self.disconnected = False

    async def start(self) -> None:
        self.started = True

    async def get_me(self):
        return self.me

    async def disconnect(self) -> None:
        self.disconnected = True


@pytest.mark.anyio
async def test_text_dedupe_uses_telegram_account_identity(monkeypatch) -> None:
    from app.services.gateways.telegram import handlers as handlers_module

    fake_redis = FakeRedis()
    monkeypatch.setattr(
        handlers_module,
        "asyncio",
        SimpleNamespace(
            sleep=lambda _: _noop(),
        ),
    )
    monkeypatch.setattr(
        "app.utils.infrastructure.concurrency.advisory_lock",
        _fake_advisory_lock,
    )
    monkeypatch.setattr(
        "app.utils.infrastructure.redis_pool.get_redis",
        lambda: _return_async(fake_redis),
    )

    first_client = FakeTelegramClient(telegram_id=555, telegram_user="dup_account")
    second_client = FakeTelegramClient(telegram_id=555, telegram_user="dup_account")
    first_handler = TelegramMessageHandler(first_client, "influencer_a")
    second_handler = TelegramMessageHandler(second_client, "influencer_b")

    await first_handler._process_text_message(
        user_id=42,
        message_id=1001,
        text="hi",
        send_reply=lambda reply_text: first_client.send_message(chat_id=42, text=reply_text),
    )
    await second_handler._process_text_message(
        user_id=42,
        message_id=1001,
        text="hi",
        send_reply=lambda reply_text: second_client.send_message(chat_id=42, text=reply_text),
    )

    assert len(first_client.sent_messages) == 1
    assert second_client.sent_messages == []


@pytest.mark.anyio
async def test_message_handler_sends_single_private_reply(monkeypatch) -> None:
    from app.services.gateways.telegram import handlers as handlers_module

    fake_redis = FakeRedis()
    monkeypatch.setattr(
        handlers_module,
        "asyncio",
        SimpleNamespace(
            sleep=lambda _: _noop(),
        ),
    )
    monkeypatch.setattr(
        "app.utils.infrastructure.concurrency.advisory_lock",
        _fake_advisory_lock,
    )
    monkeypatch.setattr(
        "app.utils.infrastructure.redis_pool.get_redis",
        lambda: _return_async(fake_redis),
    )

    client = FakeTelegramClient(telegram_id=555, telegram_user="juliana")
    handler = TelegramMessageHandler(client, "juliana")
    message = SimpleNamespace(
        id=2001,
        text=" hey ",
        outgoing=False,
        service=None,
        from_user=SimpleNamespace(id=42),
        chat=SimpleNamespace(type="private"),
    )

    await handler._handle_incoming_message(message)

    assert client.sent_messages == [
        {"chat_id": 42, "text": handler.TEXT_REPLIES[0]}
    ]


@pytest.mark.anyio
async def test_message_handler_ignores_outgoing_messages(monkeypatch) -> None:
    from app.services.gateways.telegram import handlers as handlers_module

    fake_redis = FakeRedis()
    monkeypatch.setattr(
        "app.utils.infrastructure.concurrency.advisory_lock",
        _fake_advisory_lock,
    )
    monkeypatch.setattr(
        "app.utils.infrastructure.redis_pool.get_redis",
        lambda: _return_async(fake_redis),
    )

    client = FakeTelegramClient(telegram_id=555, telegram_user="juliana")
    handler = TelegramMessageHandler(client, "juliana")
    message = SimpleNamespace(
        id=2002,
        text="hey",
        outgoing=True,
        service=None,
        from_user=SimpleNamespace(id=42),
        chat=SimpleNamespace(type="private"),
    )

    await handler._handle_incoming_message(message)

    assert client.sent_messages == []


@pytest.mark.anyio
async def test_concurrent_message_callbacks_only_send_one_reply(monkeypatch) -> None:
    from app.services.gateways.telegram import handlers as handlers_module

    fake_redis = FakeRedis()
    monkeypatch.setattr(
        handlers_module,
        "asyncio",
        SimpleNamespace(
            sleep=lambda _: _noop(),
            Lock=asyncio.Lock,
        ),
    )
    monkeypatch.setattr(
        "app.utils.infrastructure.concurrency.advisory_lock",
        _shared_fake_advisory_lock(),
    )
    monkeypatch.setattr(
        "app.utils.infrastructure.redis_pool.get_redis",
        lambda: _return_async(fake_redis),
    )

    client = FakeTelegramClient(telegram_id=555, telegram_user="juliana")
    handler = TelegramMessageHandler(client, "juliana")
    message = SimpleNamespace(
        id=2003,
        text="hey",
        outgoing=False,
        service=None,
        from_user=SimpleNamespace(id=42),
        chat=SimpleNamespace(type="private"),
    )

    await asyncio.gather(
        handler._handle_incoming_message(message),
        handler._handle_incoming_message(message),
    )

    assert client.sent_messages == [
        {"chat_id": 42, "text": handler.TEXT_REPLIES[0]}
    ]


@pytest.mark.anyio
async def test_register_keeps_raw_updates_for_calls_only() -> None:
    client = FakeTelegramClient(telegram_id=555, telegram_user="juliana")
    handler = TelegramMessageHandler(client, "juliana")
    seen: list[str] = []

    async def fake_handle_message(message) -> None:
        seen.append(f"message:{message.id}")

    async def fake_handle_call(update) -> None:
        seen.append(type(update).__name__)

    handler._handle_incoming_message = fake_handle_message  # type: ignore[method-assign]
    handler._handle_incoming_call = fake_handle_call  # type: ignore[method-assign]
    handler.register()

    assert len(client.message_handlers) == 1
    assert len(client.raw_update_handlers) == 1

    class FakeUpdatePhoneCall:
        pass

    await client.message_handlers[0](client, SimpleNamespace(id=3001))
    await client.raw_update_handlers[0](client, FakeUpdatePhoneCall(), None, None)

    assert seen[0] == "message:3001"
    assert seen[1] == "FakeUpdatePhoneCall"


def test_create_session_rejects_duplicate_telegram_account(monkeypatch, tmp_path: Path) -> None:
    from app.services.gateways.telegram import session_manager as session_manager_module

    monkeypatch.setattr(session_manager_module.settings, "TELEGRAM_API_ID", 123)
    monkeypatch.setattr(session_manager_module.settings, "TELEGRAM_API_HASH", "hash")
    monkeypatch.setattr(
        session_manager_module.settings,
        "TELEGRAM_SESSIONS_DIR",
        str(tmp_path),
    )
    monkeypatch.setattr(session_manager_module, "Client", FakeResumeClient)

    manager = TelegramSessionManager()
    existing_client = FakeTelegramClient(telegram_id=999, telegram_user="same_account")
    manager._sessions["existing_influencer"] = existing_client
    (tmp_path / "influencer_new_influencer.session").write_text("placeholder")

    with pytest.raises(ValueError, match="existing_influencer"):
        _run_async(manager.create_session("new_influencer"))

    assert (tmp_path / "influencer_new_influencer.session").exists()


def test_list_sessions_includes_telegram_identity() -> None:
    manager = TelegramSessionManager()
    client = FakeTelegramClient(telegram_id=321, telegram_user="juliana_bot")
    manager._sessions["juliana"] = client

    assert manager.list_sessions() == [
        {
            "influencer_id": "juliana",
            "connected": True,
            "telegram_user": "juliana_bot",
            "telegram_id": 321,
        }
    ]


def test_verify_code_route_returns_collision_as_400(monkeypatch) -> None:
    from app.api.routes import telegram_admin as telegram_admin_module

    async def _fake_verify_code(*args, **kwargs):
        raise ValueError(
            "Telegram account collision: influencer 'existing_influencer' already uses telegram_id=999."
        )

    app = FastAPI()
    app.include_router(telegram_admin_router)
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=1)
    monkeypatch.setattr(telegram_admin_module.settings, "TELEGRAM_USERBOT_ENABLED", True)
    monkeypatch.setattr(
        telegram_admin_module.session_manager,
        "verify_code",
        _fake_verify_code,
    )

    client = TestClient(app)
    response = client.post(
        "/telegram/sessions/verify-code",
        json={"influencer_id": "new_influencer", "code": "12345"},
    )

    assert response.status_code == 400
    assert "Telegram account collision" in response.json()["detail"]


@asynccontextmanager
async def _fake_advisory_lock(*args, **kwargs):
    yield True


def _shared_fake_advisory_lock():
    held: dict[str, asyncio.Lock] = {}

    @asynccontextmanager
    async def _lock(name: str, *args, **kwargs):
        lock = held.setdefault(name, asyncio.Lock())
        if lock.locked():
            yield False
            return
        await lock.acquire()
        try:
            yield True
        finally:
            lock.release()

    return _lock


async def _noop() -> None:
    return None


async def _return_async(value):
    return value


def _run_async(awaitable):
    import asyncio

    return asyncio.run(awaitable)
