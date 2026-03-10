import pytest

from app.use_cases import admin_history_cleanup


class _FakeRedis:
    def __init__(self, deleted_count: int = 0):
        self.deleted_count = deleted_count
        self.deleted_args = None

    async def delete(self, *keys):
        self.deleted_args = keys
        return self.deleted_count


@pytest.mark.asyncio
async def test_clear_elevenlabs_conversation_cache_single_chat():
    fake_redis = _FakeRedis(deleted_count=3)

    async def _fake_get_redis():
        return fake_redis

    original = admin_history_cleanup.get_redis
    admin_history_cleanup.get_redis = _fake_get_redis
    try:
        result = await admin_history_cleanup.clear_elevenlabs_conversation_cache(["chat_1"])
    finally:
        admin_history_cleanup.get_redis = original

    assert fake_redis.deleted_args == (
        "mem_summary:chat_1",
        "ai_mem_summary:chat_1",
        "greeting:chat_1",
    )
    assert result == {
        "chat_ids": 1,
        "keys_attempted": 3,
        "keys_deleted": 3,
        "failed_chat_ids": [],
    }


@pytest.mark.asyncio
async def test_clear_elevenlabs_conversation_cache_multiple_chats_deduped():
    fake_redis = _FakeRedis(deleted_count=6)

    async def _fake_get_redis():
        return fake_redis

    original = admin_history_cleanup.get_redis
    admin_history_cleanup.get_redis = _fake_get_redis
    try:
        result = await admin_history_cleanup.clear_elevenlabs_conversation_cache(
            ["chat_2", "chat_1", "chat_2"]
        )
    finally:
        admin_history_cleanup.get_redis = original

    assert fake_redis.deleted_args == (
        "mem_summary:chat_1",
        "ai_mem_summary:chat_1",
        "greeting:chat_1",
        "mem_summary:chat_2",
        "ai_mem_summary:chat_2",
        "greeting:chat_2",
    )
    assert result == {
        "chat_ids": 2,
        "keys_attempted": 6,
        "keys_deleted": 6,
        "failed_chat_ids": [],
    }


@pytest.mark.asyncio
async def test_clear_elevenlabs_conversation_cache_redis_error_is_non_fatal():
    async def _fake_get_redis():
        raise RuntimeError("redis down")

    original = admin_history_cleanup.get_redis
    admin_history_cleanup.get_redis = _fake_get_redis
    try:
        result = await admin_history_cleanup.clear_elevenlabs_conversation_cache(["chat_1", "chat_2"])
    finally:
        admin_history_cleanup.get_redis = original

    assert result == {
        "chat_ids": 2,
        "keys_attempted": 6,
        "keys_deleted": 0,
        "failed_chat_ids": ["chat_1", "chat_2"],
    }
