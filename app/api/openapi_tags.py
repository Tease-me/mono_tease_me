from app.core.config import settings


OPENAPI_TAGS = [
    {
        "name": "Auth",
        "description": "Authentication, login, logout, token refresh, and account session endpoints.",
    },
    {
        "name": "Chat",
        "description": "Main chat endpoints for user conversations and chat interactions.",
    },
    {
        "name": "Chat 18",
        "description": "Adult chat endpoints for 18+ conversation flows.",
    },
    {
        "name": "Adult Calls",
        "description": "Adult character voice token endpoints using character prompts and first-message selection.",
    },
    {
        "name": "Push",
        "description": "Push notification registration and delivery preference endpoints.",
    },
    {
        "name": "Billing",
        "description": "Billing and wallet-related endpoints for credits and usage.",
    },
    {"name": "Checkout", "description": "Checkout and payment initiation endpoints."},
    {
        "name": "Influencer",
        "description": "Influencer profile, bio, media, and public influencer data endpoints.",
    },
    {
        "name": "User",
        "description": "User profile, account, and user-owned resource endpoints.",
    },
    {
        "name": "ElevenLabs",
        "description": "ElevenLabs voice, call, and conversation integration endpoints.",
    },
    {
        "name": "Follow",
        "description": "Follow and unfollow endpoints for influencer relationships.",
    },
    {
        "name": "Subscriptions",
        "description": "Influencer subscription and recurring billing endpoints.",
    },
    {"name": "Health", "description": "Health check and service readiness endpoints."},
    {
        "name": "Webhooks",
        "description": "Webhook endpoints for external providers and async integration callbacks.",
    },
    {
        "name": "System Prompts",
        "description": "Admin endpoints for managing system prompt configuration.",
    },
    {
        "name": "Pre Influencers",
        "description": "Pre-influencer onboarding, survey, and setup endpoints.",
    },
    {
        "name": "Social",
        "description": "Social platform and social graph integration endpoints.",
    },
    {
        "name": "Relationship",
        "description": "Relationship state and relationship progression endpoints.",
    },
    {
        "name": "Re Engagement",
        "description": "Re-engagement campaign and outreach-related endpoints.",
    },
    {"name": "Verification", "description": "Identity and age verification endpoints."},
    {
        "name": "Admin Chats",
        "description": "Admin chat history cleanup and chat inspection endpoints.",
    },
    {
        "name": "Admin Logs",
        "description": "Admin log browsing, download, and streaming endpoints.",
    },
    {
        "name": "Admin Users",
        "description": "Admin user listing and user lookup endpoints.",
    },
    {
        "name": "Admin Relationships",
        "description": "Admin relationship inspection and relationship override endpoints.",
    },
    {
        "name": "Admin Moderation",
        "description": "Admin moderation dashboard and violation review endpoints.",
    },
    {
        "name": "Admin Characters",
        "description": "Admin adult character catalog, influencer character assets, and sample media endpoints.",
    },
    {
        "name": "Admin Knowledge",
        "description": "Admin influencer knowledge management endpoints.",
    },
    {
        "name": "Admin Usage",
        "description": "Admin API usage reporting and error analytics endpoints.",
    },
    {
        "name": "Admin Analytics",
        "description": "Admin product, growth, engagement, spending, and retention analytics endpoints.",
    },
    {
        "name": "Admin Email Assets",
        "description": "Admin-managed email asset upload and retrieval endpoints.",
    },
    {
        "name": "Admin Influencer Assets",
        "description": "Admin influencer landing, email header, and Telegram welcome media endpoints.",
    },
    {
        "name": "Admin Telegram Funnel",
        "description": "Admin Telegram funnel analytics and reporting endpoints.",
    },
    {
        "name": "MJ Promoter",
        "description": "Internal MJ Promoter service-to-service endpoints.",
    },
]

if settings.is_production:
    OPENAPI_TAGS = [tag for tag in OPENAPI_TAGS if tag["name"] != "MJ Promoter"]
