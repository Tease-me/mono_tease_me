from __future__ import annotations

from contextlib import asynccontextmanager
from types import SimpleNamespace

import pytest

from app.services.gateways.telegram import voice_engine


class _FakeClient:
    me = SimpleNamespace(id=1)


class _FakePtg:
    async def leave_call(self, _chat_id):
        return None


@asynccontextmanager
async def _fake_session_local():
    yield object()


def _make_session() -> voice_engine.VoiceCallSession:
    return voice_engine.VoiceCallSession(
        client=_FakeClient(),
        ptg=_FakePtg(),
        influencer_id="juliana",
        telegram_user_id=123,
        chat_id=456,
        agent_id="agent_1",
        voice_id="voice_1",
        max_duration_secs=0,
    )


@pytest.mark.anyio
async def test_trial_timeout_and_hangup_send_sequence_only_once(monkeypatch) -> None:
    sent_calls: list[tuple[int, int, str]] = []
    tracked: list[tuple[int, str]] = []

    monkeypatch.setattr(voice_engine, "SessionLocal", _fake_session_local)
    monkeypatch.setattr(
        "app.services.telegram_call_service.send_trial_expired_messages",
        lambda client, db, chat_id, telegram_user_id, influencer_id: _record_send(
            sent_calls, chat_id, telegram_user_id, influencer_id
        ),
    )
    monkeypatch.setattr(
        "app.services.funnel_tracking_service.track_trial_exhausted",
        lambda telegram_user_id, influencer_id: _record_track(
            tracked, telegram_user_id, influencer_id
        ),
    )

    session = _make_session()
    session._is_active = True
    session.stop = _stop_and_deactivate(session)  # type: ignore[method-assign]

    await session._trial_timer()
    await session._send_trial_ended_on_hangup()

    assert sent_calls == [(456, 123, "juliana")]
    assert tracked == [(123, "juliana")]
    assert session._trial_messages_sent is True


@pytest.mark.anyio
async def test_hangup_send_sequence_is_noop_after_first_call(monkeypatch) -> None:
    sent_calls: list[tuple[int, int, str]] = []
    tracked: list[tuple[int, str]] = []

    monkeypatch.setattr(voice_engine, "SessionLocal", _fake_session_local)
    monkeypatch.setattr(
        "app.services.telegram_call_service.send_trial_expired_messages",
        lambda client, db, chat_id, telegram_user_id, influencer_id: _record_send(
            sent_calls, chat_id, telegram_user_id, influencer_id
        ),
    )
    monkeypatch.setattr(
        "app.services.funnel_tracking_service.track_trial_exhausted",
        lambda telegram_user_id, influencer_id: _record_track(
            tracked, telegram_user_id, influencer_id
        ),
    )

    session = _make_session()

    await session._send_trial_ended_on_hangup()
    await session._send_trial_ended_on_hangup()

    assert sent_calls == [(456, 123, "juliana")]
    assert tracked == [(123, "juliana")]


@pytest.mark.anyio
async def test_trial_end_failure_still_prevents_duplicate_retry(monkeypatch) -> None:
    send_attempts: list[str] = []
    tracked: list[tuple[int, str]] = []

    async def _boom(*args, **kwargs):
        send_attempts.append("boom")
        raise RuntimeError("send failed")

    monkeypatch.setattr(voice_engine, "SessionLocal", _fake_session_local)
    monkeypatch.setattr(
        "app.services.telegram_call_service.send_trial_expired_messages",
        _boom,
    )
    monkeypatch.setattr(
        "app.services.funnel_tracking_service.track_trial_exhausted",
        lambda telegram_user_id, influencer_id: _record_track(
            tracked, telegram_user_id, influencer_id
        ),
    )

    session = _make_session()

    await session._send_trial_ended_on_hangup()
    await session._send_trial_ended_on_hangup()

    assert send_attempts == ["boom"]
    assert tracked == [(123, "juliana")]
    assert session._trial_messages_sent is True


async def _record_send(
    sent_calls: list[tuple[int, int, str]],
    chat_id: int,
    telegram_user_id: int,
    influencer_id: str,
) -> None:
    sent_calls.append((chat_id, telegram_user_id, influencer_id))


async def _record_track(
    tracked: list[tuple[int, str]],
    telegram_user_id: int,
    influencer_id: str,
) -> None:
    tracked.append((telegram_user_id, influencer_id))


def _stop_and_deactivate(session: voice_engine.VoiceCallSession):
    async def _stop(*, reason: str = "ended") -> None:
        session._is_active = False

    return _stop
