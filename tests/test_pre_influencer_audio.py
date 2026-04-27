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
        survey_token: str = "survey-token",
        password: str = "temporary-password",
    ) -> None:
        self.id = pre_id
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
        return "pre-influencer-audio/123/test.webm"

    monkeypatch.setattr(
        pre_influencers_route,
        "save_pre_influencer_audio_to_s3",
        _fake_save,
    )
    monkeypatch.setattr(
        pre_influencers_route,
        "generate_presigned_url",
        lambda key: f"https://cdn.test/{key}",
    )

    response = client.post(
        "/pre-influencers/123/audio",
        params={"token": "survey-token", "temp_password": "temporary-password"},
        files={"file": ("voice.webm", b"audio-bytes", "audio/webm")},
    )

    assert response.status_code == 200
    assert response.json() == {
        "key": "pre-influencer-audio/123/test.webm",
        "url": "https://cdn.test/pre-influencer-audio/123/test.webm",
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
    db = FakeSession(FakePreInfluencer(pre_id=123))
    client = TestClient(_build_app(db))

    async def _fake_list(pre_id: str):
        assert pre_id == "123"
        return [
            "pre-influencer-audio/123/one.webm",
            "pre-influencer-audio/123/two.webm",
        ]

    monkeypatch.setattr(
        pre_influencers_route,
        "list_pre_influencer_audio_keys",
        _fake_list,
    )
    monkeypatch.setattr(
        pre_influencers_route,
        "generate_presigned_url",
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
                "key": "pre-influencer-audio/123/one.webm",
                "download_url": "https://cdn.test/pre-influencer-audio/123/one.webm",
            },
            {
                "key": "pre-influencer-audio/123/two.webm",
                "download_url": "https://cdn.test/pre-influencer-audio/123/two.webm",
            },
        ],
    }
    assert db.committed is False


def test_list_pre_influencer_audio_returns_404_when_missing(monkeypatch) -> None:
    db = FakeSession(FakePreInfluencer(pre_id=123))
    client = TestClient(_build_app(db))

    async def _fake_list(_pre_id: str):
        return []

    monkeypatch.setattr(
        pre_influencers_route,
        "list_pre_influencer_audio_keys",
        _fake_list,
    )

    response = client.get(
        "/pre-influencers/123/audio",
        params={"token": "survey-token", "temp_password": "temporary-password"},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Pre-influencer has no audio file stored"
    assert db.committed is False


def test_delete_pre_influencer_audio_accepts_new_prefix(monkeypatch) -> None:
    db = FakeSession(FakePreInfluencer(pre_id=123))
    client = TestClient(_build_app(db))
    captured: list[str] = []

    async def _fake_delete(key: str):
        captured.append(key)

    monkeypatch.setattr(pre_influencers_route, "delete_file_from_s3", _fake_delete)

    response = client.request(
        "DELETE",
        "/pre-influencers/influencer-audio/123",
        json={"key": "pre-influencer-audio/123/test.webm"},
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True}
    assert captured == ["pre-influencer-audio/123/test.webm"]


def test_delete_pre_influencer_audio_rejects_invalid_prefix(monkeypatch) -> None:
    db = FakeSession(FakePreInfluencer(pre_id=123))
    client = TestClient(_build_app(db))
    called = False

    async def _fake_delete(_key: str):
        nonlocal called
        called = True

    monkeypatch.setattr(pre_influencers_route, "delete_file_from_s3", _fake_delete)

    response = client.request(
        "DELETE",
        "/pre-influencers/influencer-audio/123",
        json={"key": "influencer-audio/123/test.webm"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid audio key for this influencer"
    assert called is False
