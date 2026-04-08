from fastapi import APIRouter

from .analytics import router as analytics_router
from .characters import router as characters_router
from .chats import router as chats_router
from .email_assets import router as email_assets_router
from .influencer_assets import router as influencer_assets_router
from .knowledge import router as knowledge_router
from .logs import router as logs_router
from .moderation import router as moderation_router
from .relationships import router as relationships_router
from .telegram_funnel import router as telegram_funnel_router
from .usage import router as usage_router
from .users import router as users_router

router = APIRouter(prefix="/admin")
router.include_router(chats_router)
router.include_router(logs_router)
router.include_router(users_router)
router.include_router(relationships_router)
router.include_router(moderation_router)
router.include_router(characters_router)
router.include_router(influencer_assets_router)
router.include_router(email_assets_router)
router.include_router(knowledge_router)
router.include_router(usage_router)
router.include_router(analytics_router)
router.include_router(telegram_funnel_router)
