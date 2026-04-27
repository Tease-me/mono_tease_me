from __future__ import annotations

import pytest

from app.utils.storage import s3 as s3_module


class FakeS3Client:
    def __init__(self) -> None:
        self.head_calls: list[dict] = []
        self.copy_calls: list[dict] = []

    def head_object(self, **kwargs):
        self.head_calls.append(kwargs)
        return {"ContentType": "audio/webm"}

    def copy_object(self, **kwargs):
        self.copy_calls.append(kwargs)


@pytest.mark.anyio
async def test_copy_pre_influencer_audio_to_influencer_audio_preserves_extension(monkeypatch) -> None:
    fake_s3 = FakeS3Client()

    monkeypatch.setattr(s3_module, "s3", fake_s3)
    monkeypatch.setattr(s3_module.settings, "BUCKET_NAME", "test-bucket")
    monkeypatch.setattr(s3_module.uuid, "uuid4", lambda: "fixed-uuid")

    destination_key = await s3_module.copy_pre_influencer_audio_to_influencer_audio(
        "pre-influencer-audio/123/sample.webm",
        "creatorname",
    )

    assert destination_key == "influencer-audio/creatorname/fixed-uuid.webm"
    assert fake_s3.head_calls == [
        {"Bucket": "test-bucket", "Key": "pre-influencer-audio/123/sample.webm"}
    ]
    assert fake_s3.copy_calls == [
        {
            "Bucket": "test-bucket",
            "CopySource": {
                "Bucket": "test-bucket",
                "Key": "pre-influencer-audio/123/sample.webm",
            },
            "Key": "influencer-audio/creatorname/fixed-uuid.webm",
            "ContentType": "audio/webm",
            "MetadataDirective": "COPY",
        }
    ]
