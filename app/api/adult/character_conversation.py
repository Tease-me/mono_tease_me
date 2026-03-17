from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.schemas.adult.character_conversation import (
    CharacterConversationTokenRequest,
    CharacterConversationTokenResponse,
)
from app.db.models import User
from app.db.session import get_db
from app.services.use_cases.adult.character_conversation_token import (
    create_character_conversation_token,
)
from app.utils.auth.dependencies import get_current_user

router = APIRouter(prefix="/elevenlabs", tags=["adult-character-calls"])


@router.get(
    "/character-conversation-token",
    response_model=CharacterConversationTokenResponse,
)
async def get_character_conversation_token(
    influencer_id: str,
    character_id: int,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    payload = CharacterConversationTokenRequest(
        influencer_id=influencer_id,
        character_id=character_id,
    )
    return await create_character_conversation_token(db=db, payload=payload)
