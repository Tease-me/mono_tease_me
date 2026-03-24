from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.data.schemas.adult.adult_conversation import (
    AdultConversationTokenRequest,
    AdultConversationTokenResponse,
)
from app.data.models import User
from app.core.session import get_db
from app.use_cases.adult.adult_conversation_token import (
    create_adult_conversation_token,
)
from app.utils.auth.dependencies import get_current_user

router = APIRouter(prefix="/adult", tags=["adult-calls"])


@router.get(
    "/conversation-token",
    response_model=AdultConversationTokenResponse,
)
async def get_adult_conversation_token(
    influencer_id: str,
    character_id: int,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    payload = AdultConversationTokenRequest(
        influencer_id=influencer_id,
        character_id=character_id,
    )
    return await create_adult_conversation_token(
        db=db,
        user_id=_current_user.id,
        payload=payload,
    )
