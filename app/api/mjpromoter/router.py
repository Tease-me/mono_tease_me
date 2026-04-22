from fastapi import APIRouter

from .pre_influencers import router as pre_influencers_router

router = APIRouter(prefix="/mjpromoter", tags=["MJ Promoter"])
router.include_router(pre_influencers_router)
