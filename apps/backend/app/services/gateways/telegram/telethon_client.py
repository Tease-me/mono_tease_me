from __future__ import annotations

from io import IOBase
from typing import Any

from telethon import TelegramClient


class TelethonClientAdapter:
    """Thin adapter exposing the Telegram client surface used by the app."""

    def __init__(self, raw_client: TelegramClient):
        self.raw = raw_client
        self._me = None
        self._entity_cache: dict[int, Any] = {}

    @property
    def me(self):
        return self._me

    @property
    def is_connected(self) -> bool:
        return self.raw.is_connected()

    async def get_me(self):
        if self._me is None:
            self._me = await self.raw.get_me()
        return self._me

    def on(self, *args, **kwargs):
        return self.raw.on(*args, **kwargs)

    def add_event_handler(self, *args, **kwargs):
        return self.raw.add_event_handler(*args, **kwargs)

    def remove_event_handler(self, *args, **kwargs):
        return self.raw.remove_event_handler(*args, **kwargs)

    async def connect(self) -> None:
        await self.raw.connect()

    async def disconnect(self) -> None:
        await self.raw.disconnect()

    async def log_out(self) -> bool:
        return await self.raw.log_out()

    @staticmethod
    def _normalize_parse_mode(parse_mode: Any) -> str | tuple[()]:
        if parse_mode in (None, "", ()):
            return ()
        if isinstance(parse_mode, str):
            return parse_mode.lower()
        name = getattr(parse_mode, "name", None)
        if isinstance(name, str):
            return name.lower()
        value = getattr(parse_mode, "value", None)
        if isinstance(value, str):
            return value.lower()
        return "html"

    @staticmethod
    def _prepare_file(file_obj: Any, file_name: str | None = None):
        if isinstance(file_obj, IOBase):
            try:
                file_obj.seek(0)
            except Exception:
                pass
            if file_name:
                file_obj.name = file_name
        return file_obj

    def cache_entity(self, entity_id: int | None, entity: Any) -> None:
        if entity_id is None or entity is None:
            return
        self._entity_cache[entity_id] = entity

    async def _resolve_entity(self, entity: Any) -> Any:
        if not isinstance(entity, int):
            return entity

        cached_entity = self._entity_cache.get(entity)
        if cached_entity is not None:
            return cached_entity

        resolved_entity = await self.raw.get_input_entity(entity)
        self.cache_entity(entity, resolved_entity)
        return resolved_entity

    async def send_message(self, chat_id: Any, text: str, parse_mode=None, **kwargs):
        return await self.raw.send_message(
            entity=await self._resolve_entity(chat_id),
            message=text,
            parse_mode=self._normalize_parse_mode(parse_mode),
            **kwargs,
        )

    async def send_photo(
        self,
        chat_id: Any,
        photo,
        caption: str | None = None,
        parse_mode=None,
        **kwargs,
    ):
        return await self.raw.send_file(
            entity=await self._resolve_entity(chat_id),
            file=self._prepare_file(photo),
            caption=caption,
            parse_mode=self._normalize_parse_mode(parse_mode),
            **kwargs,
        )

    async def send_video(
        self,
        chat_id: Any,
        video,
        caption: str | None = None,
        file_name: str | None = None,
        parse_mode=None,
        **kwargs,
    ):
        return await self.raw.send_file(
            entity=await self._resolve_entity(chat_id),
            file=self._prepare_file(video, file_name=file_name),
            caption=caption,
            parse_mode=self._normalize_parse_mode(parse_mode),
            supports_streaming=True,
            **kwargs,
        )

    async def send_voice(self, chat_id: Any, voice, **kwargs):
        return await self.raw.send_file(
            entity=await self._resolve_entity(chat_id),
            file=self._prepare_file(voice),
            voice_note=True,
            **kwargs,
        )

    def __getattr__(self, item: str):
        return getattr(self.raw, item)
