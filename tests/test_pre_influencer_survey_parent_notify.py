from __future__ import annotations

from types import SimpleNamespace

import pytest

from app.api.routes import pre_influencers as pre_influencers_route


def test_merge_survey_answers_preserves_server_notification_meta() -> None:
    existing = {
        "q1": "old",
        "__meta": {
            "parent_ref_id": "jorlyn",
            "parent_promoter_survey_completed_notified": True,
            "parent_promoter_survey_completed_notified_at": "2026-05-19T12:00:00+00:00",
            "parent_promoter_id": "parent-1",
        },
    }
    incoming = {
        "q1": "new",
        "__meta": {
            "parent_ref_id": "jorlyn",
            "account_manager_email": "am@example.com",
        },
    }

    merged = pre_influencers_route._merge_survey_answers(existing, incoming)

    assert merged["q1"] == "new"
    assert merged["__meta"]["account_manager_email"] == "am@example.com"
    assert merged["__meta"]["parent_promoter_survey_completed_notified"] is True
    assert merged["__meta"]["parent_promoter_survey_completed_notified_at"] == (
        "2026-05-19T12:00:00+00:00"
    )
    assert merged["__meta"]["parent_promoter_id"] == "parent-1"


def test_merge_survey_answers_copies_meta_when_incoming_omits_it() -> None:
    existing = {"__meta": {"parent_ref_id": "jorlyn"}}
    incoming = {"q1": "answer"}

    merged = pre_influencers_route._merge_survey_answers(existing, incoming)

    assert merged == {"q1": "answer", "__meta": {"parent_ref_id": "jorlyn"}}


@pytest.mark.asyncio
async def test_try_notify_skips_when_terms_not_accepted(monkeypatch) -> None:
    pre = SimpleNamespace(
        id=42,
        username="janedoe",
        full_name="Jane Doe",
        email="jane@example.com",
        fp_promoter_id=None,
        terms_agreement=False,
        survey_step=10,
        survey_answers={
            "__meta": {
                "parent_promoter_id": "parent-1",
            }
        },
    )
    db = SimpleNamespace()

    called = False

    async def fake_notify(_pre, _db):
        nonlocal called
        called = True

    async def fake_load_survey_questions(_db):
        return [{"id": i} for i in range(5)]

    monkeypatch.setattr(
        pre_influencers_route,
        "load_survey_questions",
        fake_load_survey_questions,
    )
    monkeypatch.setattr(
        pre_influencers_route,
        "_notify_parent_promoter_if_needed",
        fake_notify,
    )

    await pre_influencers_route._try_notify_parent_promoter_when_ready(pre, db)

    assert called is False


@pytest.mark.asyncio
async def test_try_notify_skips_when_survey_not_complete(monkeypatch) -> None:
    pre = SimpleNamespace(
        id=42,
        username="janedoe",
        full_name="Jane Doe",
        email="jane@example.com",
        fp_promoter_id=None,
        terms_agreement=True,
        survey_step=0,
        survey_answers={"__meta": {"parent_promoter_id": "parent-1"}},
    )
    db = SimpleNamespace()
    called = False

    async def fake_notify(_pre, _db):
        nonlocal called
        called = True

    async def fake_load_survey_questions(_db):
        return [{"id": i} for i in range(5)]

    monkeypatch.setattr(
        pre_influencers_route,
        "load_survey_questions",
        fake_load_survey_questions,
    )
    monkeypatch.setattr(
        pre_influencers_route,
        "_notify_parent_promoter_if_needed",
        fake_notify,
    )

    await pre_influencers_route._try_notify_parent_promoter_when_ready(pre, db)

    assert called is False


@pytest.mark.asyncio
async def test_try_notify_sends_when_survey_complete_and_terms_accepted(
    monkeypatch,
) -> None:
    pre = SimpleNamespace(
        id=42,
        username="janedoe",
        full_name="Jane Doe",
        email="jane@example.com",
        fp_promoter_id=None,
        terms_agreement=True,
        survey_step=4,
        survey_answers={"__meta": {"parent_promoter_id": "parent-1"}},
    )
    db = SimpleNamespace()
    called = False

    async def fake_notify(_pre, _db):
        nonlocal called
        called = True

    async def fake_load_survey_questions(_db):
        return [{"id": i} for i in range(5)]

    monkeypatch.setattr(
        pre_influencers_route,
        "load_survey_questions",
        fake_load_survey_questions,
    )
    monkeypatch.setattr(
        pre_influencers_route,
        "_notify_parent_promoter_if_needed",
        fake_notify,
    )

    await pre_influencers_route._try_notify_parent_promoter_when_ready(pre, db)

    assert called is True


@pytest.mark.asyncio
async def test_notify_parent_promoter_sends_only_once(monkeypatch) -> None:
    pre = SimpleNamespace(
        id=42,
        username="janedoe",
        full_name="Jane Doe",
        email="jane@example.com",
        fp_promoter_id=None,
        survey_answers={
            "__meta": {
                "parent_ref_id": "jorlyn",
                "parent_promoter_id": "parent-1",
            }
        },
    )
    db = SimpleNamespace(committed=0)

    async def fake_commit():
        db.committed += 1

    async def fake_refresh(_obj):
        return None

    db.commit = fake_commit
    db.refresh = fake_refresh
    db.add = lambda _obj: None

    sent: list[str] = []

    async def fake_get_promoter_v2(promoter_id):
        assert promoter_id == "parent-1"
        return {"email": "am@example.com"}

    def fake_send_email(**kwargs):
        sent.append(kwargs["to_email"])
        return {"MessageId": "msg-1"}

    monkeypatch.setattr(
        pre_influencers_route,
        "fp_get_promoter_v2",
        fake_get_promoter_v2,
    )
    monkeypatch.setattr(
        pre_influencers_route,
        "send_influencer_survey_completed_email_to_promoter",
        fake_send_email,
    )

    await pre_influencers_route._notify_parent_promoter_if_needed(pre, db)
    await pre_influencers_route._notify_parent_promoter_if_needed(pre, db)

    assert sent == ["am@example.com"]
    assert pre.survey_answers["__meta"]["parent_promoter_survey_completed_notified"] is True
    assert db.committed == 1


@pytest.mark.asyncio
async def test_notify_parent_promoter_uses_account_manager_email_fallback(
    monkeypatch,
) -> None:
    pre = SimpleNamespace(
        id=7,
        username="creator",
        full_name=None,
        email="creator@example.com",
        fp_promoter_id=None,
        survey_answers={
            "__meta": {
                "account_manager_email": "manager@example.com",
            }
        },
    )
    db = SimpleNamespace(committed=0)

    async def fake_commit():
        db.committed += 1

    db.commit = fake_commit
    db.refresh = lambda _obj: None
    db.add = lambda _obj: None

    sent: list[str] = []

    monkeypatch.setattr(
        pre_influencers_route,
        "send_influencer_survey_completed_email_to_promoter",
        lambda **kwargs: sent.append(kwargs["to_email"]) or {"MessageId": "x"},
    )

    await pre_influencers_route._notify_parent_promoter_if_needed(pre, db)

    assert sent == ["manager@example.com"]


@pytest.mark.asyncio
async def test_notify_parent_promoter_retries_after_send_failure(monkeypatch) -> None:
    pre = SimpleNamespace(
        id=9,
        username="creator",
        full_name=None,
        email="creator@example.com",
        fp_promoter_id=None,
        survey_answers={
            "__meta": {
                "account_manager_email": "manager@example.com",
            }
        },
    )
    db = SimpleNamespace(committed=0)

    async def fake_commit():
        db.committed += 1

    db.commit = fake_commit
    db.refresh = lambda _obj: None
    db.add = lambda _obj: None

    send_attempts = {"count": 0}

    def fake_send_email(**_kwargs):
        send_attempts["count"] += 1
        if send_attempts["count"] == 1:
            return None
        return {"MessageId": "msg-1"}

    monkeypatch.setattr(
        pre_influencers_route,
        "send_influencer_survey_completed_email_to_promoter",
        fake_send_email,
    )

    await pre_influencers_route._notify_parent_promoter_if_needed(pre, db)
    assert pre.survey_answers["__meta"].get("parent_promoter_survey_completed_notified") is not True

    await pre_influencers_route._notify_parent_promoter_if_needed(pre, db)
    assert pre.survey_answers["__meta"]["parent_promoter_survey_completed_notified"] is True
    assert send_attempts["count"] == 2
    assert db.committed == 1
