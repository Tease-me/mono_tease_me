from fastapi import APIRouter

from app.core.config import settings

from .pre_influencers import router as pre_influencers_router

is_production = settings.APP_ENV.strip().lower() == "production"

router = APIRouter(
    prefix="/mjpromoter",
    tags=["MJ Promoter"],
    include_in_schema=not is_production,
)
router.include_router(pre_influencers_router)
