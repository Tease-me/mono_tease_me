from __future__ import annotations

import asyncio
from types import SimpleNamespace

import pytest

from app.services.gateways.telegram.handlers import TelegramMessageHandler
from app.services.use_cases import telegram_text_queue as queue_module


class FakeRedis:
    def __init__(self) -> None:
        self._values: dict[str, str] = {}
        self._lists: dict[str, list[str]] = {}
        self.expirations: dict[str, int] = {}

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
        if ex is not None:
            self.expirations[key] = ex
        return True

    async def get(self, key: str) -> str | None:
        return self._values.get(key)

    async def delete(self, *keys: str) -> int:
        deleted = 0
        for key in keys:
            if key in self._values:
                deleted += 1
                self._values.pop(key, None)
            if key in self._lists:
                deleted += 1
                self._lists.pop(key, None)
            self.expirations.pop(key, None)
        return deleted

    async def rpush(self, key: str, *values: str) -> int:
        bucket = self._lists.setdefault(key, [])
        bucket.extend(values)
        return len(bucket)

    async def expire(self, key: str, seconds: int) -> bool:
        self.expirations[key] = seconds
        return True

    async def exists(self, key: str) -> int:
        return int(key in self._values or key in self._lists)

    async def eval(self, script: str, numkeys: int, *keys_and_args: str):
        keys = keys_and_args[:numkeys]
        if "LRANGE" in script and "DEL" in script:
            items_key = keys[0]
            touched_key = keys[1]
            items = list(self._lists.get(items_key, []))
            self._lists.pop(items_key, None)
            self._values.pop(touched_key, None)
            self.expirations.pop(items_key, None)
            self.expirations.pop(touched_key, None)
            return items
        raise NotImplementedError(script)


class FakeTelethonClient:
    def __init__(self, telegram_id: int, username: str = "tester") -> None:
        self._tease_me_telegram_id = telegram_id
        self._tease_me_telegram_user = username
        self.message_handlers: list[object] = []
        self.raw_handlers: list[object] = []

    def on(self, event):
        def decorator(callback):
            event_name = type(event).__name__
            if event_name == "NewMessage":
                self.message_handlers.append(callback)
            else:
                self.raw_handlers.append(callback)
            return callback

        return decorator

    async def get_me(self):
        return SimpleNamespace(
            id=self._tease_me_telegram_id,
            username=self._tease_me_telegram_user,
            first_name=self._tease_me_telegram_user,
        )


class FakeEvent:
    def __init__(
        self,
        *,
        sender_id: int,
        message_id: int,
        text: str,
        username: str | None = None,
        is_private: bool = True,
        out: bool = False,
    ) -> None:
        self.sender_id = sender_id
        self.id = message_id
        self.raw_text = text
        self.is_private = is_private
        self.out = out
        self.sender = SimpleNamespace(username=username) if username else None
        self.responses: list[tuple[str, str | None]] = []

    async def get_sender(self):
        return self.sender

    async def respond(self, text: str, parse_mode: str | None = None):
        self.responses.append((text, parse_mode))


@pytest.fixture(autouse=True)
async def _reset_queue_state():
    await queue_module._reset_telegram_text_queue_state()
    yield
    await queue_module._reset_telegram_text_queue_state()


@pytest.mark.anyio
async def test_consecutive_messages_are_batched(monkeypatch) -> None:
    fake_redis = FakeRedis()
    monkeypatch.setattr(queue_module, "get_redis", lambda: _return_async(fake_redis))
    monkeypatch.setattr(
        "app.utils.infrastructure.redis_pool.get_redis",
        lambda: _return_async(fake_redis),
    )
    monkeypatch.setattr(
        queue_module.settings,
        "TELEGRAM_TEXT_BATCH_WINDOW_SECONDS",
        0.02,
    )

    client = FakeTelethonClient(telegram_id=555, username="juliana")
    handler = TelegramMessageHandler(client, "juliana")
    processed: list[tuple[int | None, str]] = []

    async def _fake_process_text_message(
        *,
        user_id: int,
        message_id: int | None,
        text: str,
        send_text,
        session_identity: str | None = None,
        session_telegram_id: int | None = None,
    ) -> None:
        processed.append((message_id, text))
        await send_text("batched-reply", None)

    handler._process_text_message = _fake_process_text_message  # type: ignore[method-assign]
    handler.register()

    await client.message_handlers[0](
        FakeEvent(sender_id=42, message_id=1001, text="hello")
    )
    second_event = FakeEvent(sender_id=42, message_id=1002, text="there")
    await client.message_handlers[0](second_event)
    await asyncio.sleep(0.08)

    assert processed == [(1002, "hello\nthere")]
    assert second_event.responses == [("batched-reply", None)]


@pytest.mark.anyio
async def test_duplicate_message_id_is_not_enqueued_twice(monkeypatch) -> None:
    fake_redis = FakeRedis()
    monkeypatch.setattr(queue_module, "get_redis", lambda: _return_async(fake_redis))
    monkeypatch.setattr(
        "app.utils.infrastructure.redis_pool.get_redis",
        lambda: _return_async(fake_redis),
    )
    monkeypatch.setattr(
        queue_module.settings,
        "TELEGRAM_TEXT_BATCH_WINDOW_SECONDS",
        0.02,
    )

    client = FakeTelethonClient(telegram_id=555, username="juliana")
    handler = TelegramMessageHandler(client, "juliana")
    processed: list[str] = []

    async def _fake_process_text_message(
        *,
        user_id: int,
        message_id: int | None,
        text: str,
        send_text,
        session_identity: str | None = None,
        session_telegram_id: int | None = None,
    ) -> None:
        processed.append(text)

    handler._process_text_message = _fake_process_text_message  # type: ignore[method-assign]
    handler.register()

    await client.message_handlers[0](
        FakeEvent(sender_id=42, message_id=2001, text="same")
    )
    await client.message_handlers[0](
        FakeEvent(sender_id=42, message_id=2001, text="same-again")
    )
    await asyncio.sleep(0.08)

    assert processed == ["same"]


@pytest.mark.anyio
async def test_ignored_username_bypasses_queue(monkeypatch) -> None:
    fake_redis = FakeRedis()
    monkeypatch.setattr(queue_module, "get_redis", lambda: _return_async(fake_redis))
    monkeypatch.setattr(
        "app.utils.infrastructure.redis_pool.get_redis",
        lambda: _return_async(fake_redis),
    )
    monkeypatch.setattr(
        queue_module.settings,
        "TELEGRAM_TEXT_BATCH_WINDOW_SECONDS",
        0.02,
    )

    client = FakeTelethonClient(telegram_id=555, username="juliana")
    handler = TelegramMessageHandler(client, "juliana")
    processed: list[str] = []

    async def _fake_process_text_message(
        *,
        user_id: int,
        message_id: int | None,
        text: str,
        send_text,
        session_identity: str | None = None,
        session_telegram_id: int | None = None,
    ) -> None:
        processed.append(text)

    handler._process_text_message = _fake_process_text_message  # type: ignore[method-assign]
    handler.register()

    await client.message_handlers[0](
        FakeEvent(
            sender_id=42,
            message_id=3001,
            text="ignored",
            username="BotFather",
        )
    )
    await asyncio.sleep(0.05)

    assert processed == []


@pytest.mark.anyio
async def test_new_batch_waits_for_current_processing_to_finish(monkeypatch) -> None:
    fake_redis = FakeRedis()
    monkeypatch.setattr(queue_module, "get_redis", lambda: _return_async(fake_redis))
    monkeypatch.setattr(
        "app.utils.infrastructure.redis_pool.get_redis",
        lambda: _return_async(fake_redis),
    )
    monkeypatch.setattr(
        queue_module.settings,
        "TELEGRAM_TEXT_BATCH_WINDOW_SECONDS",
        0.02,
    )

    client = FakeTelethonClient(telegram_id=555, username="juliana")
    handler = TelegramMessageHandler(client, "juliana")
    processed: list[str] = []

    async def _fake_process_text_message(
        *,
        user_id: int,
        message_id: int | None,
        text: str,
        send_text,
        session_identity: str | None = None,
        session_telegram_id: int | None = None,
    ) -> None:
        processed.append(text)
        if len(processed) == 1:
            await asyncio.sleep(0.05)

    handler._process_text_message = _fake_process_text_message  # type: ignore[method-assign]
    handler.register()

    await client.message_handlers[0](
        FakeEvent(sender_id=42, message_id=4001, text="first")
    )
    await client.message_handlers[0](
        FakeEvent(sender_id=42, message_id=4002, text="second")
    )
    await asyncio.sleep(0.03)
    await client.message_handlers[0](
        FakeEvent(sender_id=42, message_id=4003, text="third")
    )
    await asyncio.sleep(0.15)

    assert processed == ["first\nsecond", "third"]


async def _return_async(value):
    return value
