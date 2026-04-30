from __future__ import annotations

import pytest

from app.services.use_cases import approve_pre_influencer as approval_module


@pytest.mark.anyio
async def test_get_approval_audio_keys_prefers_pre_influencer_audio(monkeypatch) -> None:
    calls: list[tuple[str, str]] = []

    async def _fake_list_pre(pre_id: str):
        calls.append(("pre", pre_id))
        return ["pre-influencers/123/audio/voice.webm"]

    async def _fake_list_influencer(influencer_id: str):
        calls.append(("influencer", influencer_id))
        return ["influencer-audio/test/legacy.webm"]

    monkeypatch.setattr(approval_module.pre_influencer_storage, "list_audio_keys", _fake_list_pre)
    monkeypatch.setattr(approval_module, "list_influencer_audio_keys", _fake_list_influencer)

    keys = await approval_module._get_approval_audio_keys(123, "creatorname")

    assert keys == ["pre-influencers/123/audio/voice.webm"]
    assert calls == [("pre", "123")]


@pytest.mark.anyio
async def test_get_approval_audio_keys_falls_back_to_legacy_paths(monkeypatch) -> None:
    calls: list[tuple[str, str]] = []

    async def _fake_list_pre(pre_id: str):
        calls.append(("pre", pre_id))
        return []

    async def _fake_list_influencer(influencer_id: str):
        calls.append(("influencer", influencer_id))
        if influencer_id == "123":
            return []
        return ["influencer-audio/creatorname/legacy.webm"]

    monkeypatch.setattr(approval_module.pre_influencer_storage, "list_audio_keys", _fake_list_pre)
    monkeypatch.setattr(approval_module, "list_influencer_audio_keys", _fake_list_influencer)

    keys = await approval_module._get_approval_audio_keys(123, "creatorname")

    assert keys == ["influencer-audio/creatorname/legacy.webm"]
    assert calls == [
        ("pre", "123"),
        ("influencer", "123"),
        ("influencer", "creatorname"),
    ]


@pytest.mark.anyio
async def test_prepare_approval_audio_keys_copies_pre_influencer_audio(monkeypatch) -> None:
    copied: list[tuple[str, str]] = []

    async def _fake_get_keys(pre_id: int, influencer_id: str):
        assert pre_id == 123
        assert influencer_id == "creatorname"
        return ["pre-influencers/123/audio/voice.webm"]

    async def _fake_copy(source_key: str, influencer_id: str):
        copied.append((source_key, influencer_id))
        return "influencer-audio/creatorname/copied.webm"

    monkeypatch.setattr(approval_module, "_get_approval_audio_keys", _fake_get_keys)
    monkeypatch.setattr(
        approval_module,
        "copy_pre_influencer_audio_to_influencer_audio",
        _fake_copy,
    )

    keys = await approval_module._prepare_approval_audio_keys(123, "creatorname")

    assert keys == ["influencer-audio/creatorname/copied.webm"]
    assert copied == [("pre-influencers/123/audio/voice.webm", "creatorname")]


@pytest.mark.anyio
async def test_prepare_approval_audio_keys_keeps_legacy_influencer_audio(monkeypatch) -> None:
    copied = False

    async def _fake_get_keys(pre_id: int, influencer_id: str):
        assert pre_id == 123
        assert influencer_id == "creatorname"
        return ["influencer-audio/creatorname/legacy.webm"]

    async def _fake_copy(source_key: str, influencer_id: str):
        nonlocal copied
        copied = True
        return source_key

    monkeypatch.setattr(approval_module, "_get_approval_audio_keys", _fake_get_keys)
    monkeypatch.setattr(
        approval_module,
        "copy_pre_influencer_audio_to_influencer_audio",
        _fake_copy,
    )

    keys = await approval_module._prepare_approval_audio_keys(123, "creatorname")

    assert keys == ["influencer-audio/creatorname/legacy.webm"]
    assert copied is False
