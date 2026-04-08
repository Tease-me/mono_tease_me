from __future__ import annotations

import os
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

    async def send_message(self, *, chat_id: int, text: str) -> None:
        self.sent_messages.append({"chat_id": chat_id, "text": text})

    async def get_me(self):
        return SimpleNamespace(
            id=self._tease_me_telegram_id,
            username=self._tease_me_telegram_user,
            first_name=self._tease_me_telegram_user,
        )


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


async def _noop() -> None:
    return None


async def _return_async(value):
    return value


def _run_async(awaitable):
    import asyncio

    return asyncio.run(awaitable)
