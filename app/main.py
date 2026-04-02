import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.admin import router as admin_router
from app.api.adult import router as adult_router
from app.api.openapi_tags import OPENAPI_TAGS
from app.api.routes.auth import router as auth_router
from app.api.routes.billing import router as billing_router
from app.api.routes.chat import router as chat_router
from app.api.routes.chat_18 import router as chat_18_router
from app.api.routes.checkout import router as checkout_router
from app.api.routes.elevenlabs import router as elevenlabs_router
from app.api.routes.follow import router as follow_router
from app.api.routes.funnel import router as funnel_router
from app.api.routes.health_router import router as health_router
from app.api.routes.influencer import router as influencer_router
from app.api.routes.influencer_subscriptions import (
    router as influencer_subscriptions_router,
)
from app.api.routes.notify_ws import router as notify_ws_router
from app.api.routes.pre_influencers import router as pre_influencers_router
from app.api.routes.push import router as push_router
from app.api.routes.re_engagement import router as re_engagement_router
from app.api.routes.relationship import router as relationship_router
from app.api.routes.social import router as social_router
from app.api.routes.system_prompts import router as system_prompts_router
from app.api.routes.telegram_admin import router as telegram_admin_router
from app.api.routes.user import router as user_router
from app.api.routes.verification import router as verification_router
from app.api.routes.webhooks import router as webhooks_router
from app.core.logging import configure_logging
from app.services.checkout import close_checkout_client
from app.services.gateways.armloop_gateway import close_armloop_client
from app.services.gateways.elevenlabs.client import close_elevenlabs_client
from app.services.gateways.telegram import lifecycle as telegram_lifecycle
from app.utils.infrastructure.redis_pool import close_redis
from app.workers.scheduler import start_scheduler, stop_scheduler

configure_logging()
log = logging.getLogger(__name__)

origins_str = os.getenv("CORS_ORIGINS", "")
origins = [o.strip() for o in origins_str.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting re-engagement scheduler...")
    start_scheduler()
    log.info("Starting Telegram sessions...")
    await telegram_lifecycle.start_all_sessions()

    yield

    log.info("Stopping Telegram sessions...")
    await telegram_lifecycle.stop_all_sessions()
    log.info("Stopping re-engagement scheduler...")
    stop_scheduler()
    log.info("Closing Redis connection pool...")
    await close_redis()
    log.info("Closing ElevenLabs HTTP client...")
    await close_elevenlabs_client()
    log.info("Closing checkout HTTP client...")
    await close_checkout_client()
    log.info("Closing Armloop HTTP client...")
    await close_armloop_client()


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
app.include_router(chat_router)
app.include_router(chat_18_router)
app.include_router(push_router)
app.include_router(notify_ws_router)
app.include_router(billing_router)
app.include_router(checkout_router)
app.include_router(health_router)
app.include_router(influencer_router)
app.include_router(influencer_subscriptions_router)
app.include_router(adult_router)
app.include_router(user_router)
app.include_router(elevenlabs_router)
app.include_router(webhooks_router)
app.include_router(follow_router)
app.include_router(pre_influencers_router)
app.include_router(social_router)
app.include_router(admin_router)
app.include_router(relationship_router)
app.include_router(re_engagement_router)
app.include_router(verification_router)
app.include_router(telegram_admin_router)
app.include_router(system_prompts_router)
app.include_router(funnel_router)
