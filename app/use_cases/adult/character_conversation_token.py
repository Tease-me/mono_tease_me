from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.schemas.adult.character_conversation import (
    CharacterConversationTokenRequest,
    CharacterConversationTokenResponse,
)
from app.gateways.adult.elevenlabs_conversation_gateway import (
    ElevenLabsConversationGateway,
)
from app.repositories.adult.character_conversation_repository import (
    get_active_influencer_character_meta,
    get_adult_character_by_id,
    get_influencer_by_id,
)
from app.utils.adult.character_messages import pick_random_first_message


async def create_character_conversation_token(
    *,
    db: AsyncSession,
    payload: CharacterConversationTokenRequest,
    gateway: ElevenLabsConversationGateway | None = None,
) -> CharacterConversationTokenResponse:
    influencer = await get_influencer_by_id(db, payload.influencer_id)
    if not influencer:
        raise HTTPException(status_code=404, detail="Influencer not found")

    character = await get_adult_character_by_id(db, payload.character_id)
    if not character or not character.is_active:
        raise HTTPException(status_code=404, detail="Adult character not found")

    overlay = await get_active_influencer_character_meta(
        db,
        payload.influencer_id,
        payload.character_id,
    )
    if not overlay:
        raise HTTPException(status_code=404, detail="Active influencer character pairing not found")

    agent_id = influencer.influencer_agent_id_third_part
    if not agent_id:
        raise HTTPException(status_code=404, detail="Influencer agent_id not found")

    token_gateway = gateway or ElevenLabsConversationGateway()
    token = await token_gateway.get_conversation_token(agent_id)
    greeting_used = pick_random_first_message(character.first_messages)

    return CharacterConversationTokenResponse(
        token=token,
        agent_id=agent_id,
        prompt=character.prompt_template,
        greeting_used=greeting_used,
        voice_id=influencer.voice_id or settings.ELEVENLABS_VOICE_ID or None,
        native_language=influencer.native_language or "en",
        influencer_id=payload.influencer_id,
        character_id=payload.character_id,
    )
