from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.data.enums import InfluencerPublicationStatus
from app.data.models import Influencer, PreInfluencer, User
from app.services.use_cases import approve_pre_influencer as approval_module


class FakeSession:
    def __init__(self, *, pre, admin=None) -> None:
        self.pre = pre
        self.admin = admin
        self.influencers: dict[str, object] = {}
        self.added: list[object] = []
        self.committed = False
        self.rolled_back = False
        self.refreshed: list[object] = []
        self.get_calls: list[tuple[object, object]] = []

    async def get(self, model, key):
        self.get_calls.append((model, key))
        if model is PreInfluencer and key == self.pre.id:
            return self.pre
        if model is Influencer:
            return self.influencers.get(key)
        if model is User and key == 1:
            return self.admin
        return None

    def add(self, value) -> None:
        self.added.append(value)
        if isinstance(value, Influencer):
            self.influencers[value.id] = value

    async def commit(self) -> None:
        self.committed = True

    async def refresh(self, value) -> None:
        self.refreshed.append(value)

    async def rollback(self) -> None:
        self.rolled_back = True


class FakeVoicesGateway:
    async def create_voice(self, **_kwargs):
        return {"voice_id": "voice-1"}

    async def delete_voice(self, _voice_id):
        return None


class FakeAgentsGateway:
    async def upsert_agent_prompt(self, **_kwargs):
        return "agent-1"

    async def delete_agent(self, _agent_id):
        return None


def _build_pre():
    return SimpleNamespace(
        id=123,
        username="Creator Name",
        full_name="Creator Name",
        email="creator@example.com",
        survey_answers={},
        fp_promoter_id="fp-1",
        fp_ref_id="ref-1",
        status="pending",
    )


def _patch_conversion_dependencies(monkeypatch, captured_threads=None) -> None:
    async def fake_load_survey_questions(_db):
        return []

    async def fake_generate_prompt_from_markdown(_markdown, *, additional_prompt, db):
        return {"personality_rules": "Be concise."}

    async def fake_prepare_approval_audio_keys(_pre_id, _influencer_id):
        return ["pre-influencers/123/audio/voice.webm"]

    async def fake_get_s3_object_bytes(_key):
        return b"voice-bytes"

    async def fake_run_in_threadpool(func, *args, **kwargs):
        if captured_threads is not None:
            captured_threads.append((func, args, kwargs))
        return func(*args, **kwargs)

    monkeypatch.setattr(approval_module, "load_survey_questions", fake_load_survey_questions)
    monkeypatch.setattr(approval_module, "format_survey_markdown", lambda *_args: "markdown")
    monkeypatch.setattr(
        approval_module,
        "generate_prompt_from_markdown",
        fake_generate_prompt_from_markdown,
    )
    monkeypatch.setattr(
        approval_module,
        "_prepare_approval_audio_keys",
        fake_prepare_approval_audio_keys,
    )
    monkeypatch.setattr(approval_module, "get_s3_object_bytes", fake_get_s3_object_bytes)
    monkeypatch.setattr(approval_module, "_voices_gateway", FakeVoicesGateway())
    monkeypatch.setattr(approval_module, "_agents_gateway", FakeAgentsGateway())
    monkeypatch.setattr(approval_module, "run_in_threadpool", fake_run_in_threadpool)


@pytest.mark.anyio
async def test_approve_pre_influencer_sends_admin_conversion_email(monkeypatch) -> None:
    captured_email = {}
    captured_threads = []
    pre = _build_pre()
    admin = SimpleNamespace(id=1, email="admin@example.com")
    db = FakeSession(pre=pre, admin=admin)

    def fake_send_pre_influencer_converted_admin_email(**kwargs):
        captured_email.update(kwargs)
        return {"MessageId": "ses-admin-1"}

    _patch_conversion_dependencies(monkeypatch, captured_threads)
    monkeypatch.setattr(
        approval_module,
        "send_pre_influencer_converted_admin_email",
        fake_send_pre_influencer_converted_admin_email,
    )

    result = await approval_module.approve_pre_influencer(db, pre.id)

    assert result == {
        "ok": True,
        "influencer_id": "creatorname",
        "fp_ref_id": "ref-1",
        "fp_promoter_id": "fp-1",
    }
    assert db.committed is True
    assert db.rolled_back is False
    assert (User, 1) in db.get_calls
    assert captured_email == {
        "to_email": "admin@example.com",
        "pre_influencer_id": 123,
        "influencer_id": "creatorname",
        "display_name": "Creator Name",
        "creator_email": "creator@example.com",
        "publication_status": InfluencerPublicationStatus.DRAFT.value,
    }
    assert captured_threads


@pytest.mark.anyio
async def test_approve_pre_influencer_still_succeeds_when_admin_email_fails(
    monkeypatch,
) -> None:
    pre = _build_pre()
    admin = SimpleNamespace(id=1, email="admin@example.com")
    db = FakeSession(pre=pre, admin=admin)

    def fake_send_pre_influencer_converted_admin_email(**_kwargs):
        raise RuntimeError("ses unavailable")

    _patch_conversion_dependencies(monkeypatch)
    monkeypatch.setattr(
        approval_module,
        "send_pre_influencer_converted_admin_email",
        fake_send_pre_influencer_converted_admin_email,
    )

    result = await approval_module.approve_pre_influencer(db, pre.id)

    assert result["ok"] is True
    assert result["influencer_id"] == "creatorname"
    assert db.committed is True
    assert db.rolled_back is False
