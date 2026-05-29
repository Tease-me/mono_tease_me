from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import pre_influencers as pre_influencers_route
from app.core.session import get_db


class FakeResult:
    def __init__(self, row):
        self._row = row

    def scalar_one_or_none(self):
        return self._row


class FakePreInfluencer:
    def __init__(
        self,
        *,
        pre_id: int,
        username: str | None = "pre-user",
        survey_token: str = "survey-token",
        password: str = "temporary-password",
    ) -> None:
        self.id = pre_id
        self.username = username
        self.survey_token = survey_token
        self.password = password


class FakeSession:
    def __init__(self, pre=None) -> None:
        self.pre = pre
        self.committed = False

    async def execute(self, _query):
        return FakeResult(self.pre)

    async def commit(self) -> None:
        self.committed = True


def _build_app(db: FakeSession) -> FastAPI:
    app = FastAPI()
    app.include_router(pre_influencers_route.router)

    async def _override_db():
        yield db

    app.dependency_overrides[get_db] = _override_db
    return app


def test_upload_pre_influencer_audio_returns_key_and_url(monkeypatch) -> None:
    db = FakeSession(FakePreInfluencer(pre_id=123))
    client = TestClient(_build_app(db))
    captured: dict[str, str] = {}

    async def _fake_save(file_obj, filename: str, content_type: str, pre_id: str):
        assert file_obj.read() == b"audio-bytes"
        captured["filename"] = filename
        captured["content_type"] = content_type
        captured["pre_id"] = pre_id
        return "pre-influencers/123/audio/test.webm"

    monkeypatch.setattr(
        pre_influencers_route.pre_influencer_storage,
        "save_audio",
        _fake_save,
    )
    monkeypatch.setattr(
        pre_influencers_route.pre_influencer_storage,
        "generate_audio_download_url",
        lambda key: f"https://cdn.test/{key}",
    )

    response = client.post(
        "/pre-influencers/123/audio",
        params={"token": "survey-token", "temp_password": "temporary-password"},
        files={"file": ("voice.webm", b"audio-bytes", "audio/webm")},
    )

    assert response.status_code == 200
    assert response.json() == {
        "key": "pre-influencers/123/audio/test.webm",
        "url": "https://cdn.test/pre-influencers/123/audio/test.webm",
    }
    assert captured == {
        "filename": "voice.webm",
        "content_type": "audio/webm",
        "pre_id": "123",
    }
    assert db.committed is False


def test_upload_pre_influencer_audio_rejects_empty_file() -> None:
    db = FakeSession(FakePreInfluencer(pre_id=123))
    client = TestClient(_build_app(db))

    response = client.post(
        "/pre-influencers/123/audio",
        params={"token": "survey-token", "temp_password": "temporary-password"},
        files={"file": ("voice.webm", b"", "audio/webm")},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Empty file"
    assert db.committed is False


def test_upload_pre_influencer_audio_returns_404_for_missing_pre() -> None:
    db = FakeSession(None)
    client = TestClient(_build_app(db))

    response = client.post(
        "/pre-influencers/123/audio",
        params={"token": "survey-token", "temp_password": "temporary-password"},
        files={"file": ("voice.webm", b"audio-bytes", "audio/webm")},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Pre-influencer not found"
    assert db.committed is False


def test_upload_pre_influencer_audio_requires_valid_survey_access() -> None:
    db = FakeSession(FakePreInfluencer(pre_id=123))
    client = TestClient(_build_app(db))

    response = client.post(
        "/pre-influencers/123/audio",
        params={"token": "wrong-token", "temp_password": "temporary-password"},
        files={"file": ("voice.webm", b"audio-bytes", "audio/webm")},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Invalid or expired survey link"
    assert db.committed is False


def test_list_pre_influencer_audio_returns_files(monkeypatch) -> None:
    db = FakeSession(FakePreInfluencer(pre_id=123, username="  pre-user-123  "))
    client = TestClient(_build_app(db))

    async def _fake_list(username: str | None, legacy_pre_id: str):
        assert username == "pre-user-123"
        assert legacy_pre_id == "123"
        return [
            "pre-influencers/123/audio/one.webm",
            "pre-influencers/123/audio/two.webm",
        ]

    monkeypatch.setattr(
        pre_influencers_route.pre_influencer_storage,
        "list_audio_keys_with_legacy_id",
        _fake_list,
    )
    monkeypatch.setattr(
        pre_influencers_route.pre_influencer_storage,
        "generate_audio_download_url",
        lambda key: f"https://cdn.test/{key}",
    )

    response = client.get(
        "/pre-influencers/123/audio",
        params={"token": "survey-token", "temp_password": "temporary-password"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "pre_influencer_id": 123,
        "count": 2,
        "files": [
            {
                "key": "pre-influencers/123/audio/one.webm",
                "download_url": "https://cdn.test/pre-influencers/123/audio/one.webm",
            },
            {
                "key": "pre-influencers/123/audio/two.webm",
                "download_url": "https://cdn.test/pre-influencers/123/audio/two.webm",
            },
        ],
    }
    assert db.committed is False


def test_list_pre_influencer_audio_returns_empty_result_when_missing(
    monkeypatch,
) -> None:
    db = FakeSession(FakePreInfluencer(pre_id=123, username=None))
    client = TestClient(_build_app(db))

    async def _fake_list(username: str | None, legacy_pre_id: str):
        assert username is None
        assert legacy_pre_id == "123"
        return []

    monkeypatch.setattr(
        pre_influencers_route.pre_influencer_storage,
        "list_audio_keys_with_legacy_id",
        _fake_list,
    )

    response = client.get(
        "/pre-influencers/123/audio",
        params={"token": "survey-token", "temp_password": "temporary-password"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "pre_influencer_id": 123,
        "count": 0,
        "files": [],
    }
    assert db.committed is False


def test_delete_pre_influencer_audio_accepts_new_prefix(monkeypatch) -> None:
    db = FakeSession(FakePreInfluencer(pre_id=123))
    client = TestClient(_build_app(db))
    captured: list[tuple[str, str]] = []

    async def _fake_delete(pre_id: str, key: str):
        captured.append((pre_id, key))

    monkeypatch.setattr(
        pre_influencers_route.pre_influencer_storage,
        "delete_audio",
        _fake_delete,
    )

    response = client.request(
        "DELETE",
        "/pre-influencers/influencer-audio/123",
        json={"key": "pre-influencers/123/audio/test.webm"},
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert captured == [("123", "pre-influencers/123/audio/test.webm")]


def test_delete_pre_influencer_audio_rejects_invalid_prefix(monkeypatch) -> None:
    db = FakeSession(FakePreInfluencer(pre_id=123))
    client = TestClient(_build_app(db))
    captured: list[tuple[str, str]] = []

    async def _fake_delete(_pre_id: str, _key: str):
        captured.append((_pre_id, _key))
        raise ValueError("Invalid audio key for this pre-influencer")

    monkeypatch.setattr(
        pre_influencers_route.pre_influencer_storage,
        "delete_audio",
        _fake_delete,
    )

    response = client.request(
        "DELETE",
        "/pre-influencers/influencer-audio/123",
        json={"key": "influencer-audio/123/test.webm"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid audio key for this influencer"
    assert captured == [("123", "influencer-audio/123/test.webm")]
