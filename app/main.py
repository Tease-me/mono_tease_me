import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.openapi_tags import OPENAPI_TAGS
from app.api.chat import router
from app.api.chat_18 import router as chat_18_router
from app.api.auth import router as auth_router
from app.api.push import router as push_router 
from app.api import billing
from app.api.checkout import router as checkout_router

from app.api.notify_ws import router as notify_ws_router
from app.api.influencer import router as influencer_router
from app.api.influencer_subscriptions import router as influencer_subscriptions_router
from app.api.adult import router as adult_router
from app.api.user import router as user_router
from app.api.elevenlabs import router as elevenlabs_router
from app.api.webhooks import router as webhooks_router

from app.api.follow import router as follow_router
from app.api.pre_influencers import router as pre_influencers_router
from app.api.social import router as social_router
from app.api.admin import router as admin_router
from app.api.relationship import router as relationship_router
from app.api.re_engagement import router as re_engagement_router
from app.api.verification import router as verification_router

from app.api import system_prompts as system_prompts_router

from .api import health_router
from app.scheduler import start_scheduler, stop_scheduler

from app.utils.infrastructure.redis_pool import close_redis
from app.api.elevenlabs import close_elevenlabs_client
from app.core.logging import configure_logging
from app.services.checkout import close_checkout_client

configure_logging()
log = logging.getLogger(__name__)

origins_str = os.getenv("CORS_ORIGINS", "")
origins = [origin.strip() for origin in origins_str.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting re-engagement scheduler...")
    start_scheduler()
    
    yield
    
    log.info("Stopping re-engagement scheduler...")
    stop_scheduler()
    
    log.info("Closing Redis connection pool...")
    await close_redis()
    
    log.info("Closing ElevenLabs HTTP client...")
    await close_elevenlabs_client()
    
    log.info("Closing checkout HTTP client...")
    await close_checkout_client()

app = FastAPI(
    title="TeaseMe API",
    description="Backend API for auth, chat, influencer, admin, and analytics flows.",
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=OPENAPI_TAGS,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(router)
app.include_router(chat_18_router)
app.include_router(push_router)
app.include_router(notify_ws_router)
app.include_router(billing.router)
app.include_router(checkout_router)
app.include_router(influencer_router)
app.include_router(adult_router)
app.include_router(user_router)
app.include_router(elevenlabs_router)
app.include_router(follow_router)
app.include_router(influencer_subscriptions_router)
app.include_router(health_router.router)
app.include_router(webhooks_router)
app.include_router(system_prompts_router.router)
app.include_router(pre_influencers_router)
app.include_router(social_router)
app.include_router(admin_router)
app.include_router(relationship_router)
app.include_router(re_engagement_router)
app.include_router(verification_router)
