from fastapi import APIRouter

from app.core.config import settings

from .gift_codes import router as gift_codes_router
from .pre_influencers import router as pre_influencers_router
from .preregister import router as preregister_router
from .vip_invites import router as vip_invites_router
from .vip_user_status import router as vip_user_status_router

router = APIRouter(
    prefix="/mjpromoter",
    tags=["MJ Promoter"],
    include_in_schema=not settings.is_production,
)
router.include_router(preregister_router)
router.include_router(pre_influencers_router)
router.include_router(vip_invites_router)
router.include_router(vip_user_status_router, prefix="/vip-user-status")
router.include_router(gift_codes_router)
