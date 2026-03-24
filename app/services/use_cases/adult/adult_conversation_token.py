from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.services.adult_character_billing import (
    can_afford_adult_character_voice,
    get_remaining_adult_character_voice_secs,
)
from app.data.schemas.adult.adult_conversation import (
    AdultConversationTokenRequest,
    AdultConversationTokenResponse,
)
from app.services.gateways.elevenlabs.conversation_gateway import ElevenLabsConversationGateway
from app.services.repositories.adult.adult_conversation_repository import (
    get_active_influencer_character_meta,
    get_adult_character_by_id,
    get_influencer_by_id,
)
from app.utils.adult.adult_messages import pick_random_first_message


async def create_adult_conversation_token(
    *,
    db: AsyncSession,
    user_id: int,
    payload: AdultConversationTokenRequest,
    gateway: ElevenLabsConversationGateway | None = None,
) -> AdultConversationTokenResponse:
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

    ok, cost_cents, free_left = await can_afford_adult_character_voice(
        db,
        user_id=user_id,
        influencer_id=payload.influencer_id,
        character=character,
        units=10,
    )
    if not ok:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "INSUFFICIENT_CREDITS",
                "needed_cents": cost_cents,
                "free_left": free_left,
            },
        )

    credits_remainder_secs = await get_remaining_adult_character_voice_secs(
        db,
        user_id=user_id,
        influencer_id=payload.influencer_id,
        character=character,
    )

    token_gateway = gateway or ElevenLabsConversationGateway()
    token = await token_gateway.get_conversation_token(agent_id)
    greeting_used = pick_random_first_message(character.first_messages)

    return AdultConversationTokenResponse(
        token=token,
        agent_id=agent_id,
        credits_remainder_secs=credits_remainder_secs,
        prompt=character.prompt_template,
        greeting_used=greeting_used,
        voice_id=influencer.voice_id or settings.ELEVENLABS_VOICE_ID or None,
        native_language=influencer.native_language or "en",
        influencer_id=payload.influencer_id,
        character_id=payload.character_id,
    )
