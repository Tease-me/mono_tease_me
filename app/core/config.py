from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DB_URL: str
    OPENAI_API_KEY: str
    XAI_API_KEY: str
    QWEN_API_KEY: str | None = None
    QWEN_BASE_URL: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    REDIS_URL: str 
    MAX_HISTORY_WINDOW: int
    SCORE_TTL: int
    HISTORY_TTL: int

    SECRET_KEY: str
    REFRESH_SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ACCESS_TOKEN_COOKIE_NAME: str = "access_token"
    REFRESH_TOKEN_COOKIE_NAME: str = "refresh_token"
    ACCESS_TOKEN_HTTPONLY: bool = True
    REFRESH_TOKEN_HTTPONLY: bool = True
    COOKIE_DOMAIN: str | None = None
    COOKIE_SECURE: bool = False
    COOKIE_SAMESITE: str = "lax"

    ELEVENLABS_API_KEY: str
    ELEVENLABS_TTS_BASE_URL: str = "https://api.elevenlabs.io/v1/text-to-speech"
    ELEVEN_BASE_URL: str
    ELEVENLABS_AGENT_BRANCH_ID: str | None = None
    ELEVENLABS_VOICE_ID: str
    ELEVENLABS_CONVAI_WEBHOOK_SECRET: str | None = None
    
    VAPID_PUBLIC_KEY: str
    VAPID_PRIVATE_KEY: str
    VAPID_EMAIL: str | None = None

    AWS_REGION: str
    SES_SENDER: str
    SES_SERVER: str
    SES_AWS_ACCESS_KEY_ID: str
    SES_AWS_SECRET_ACCESS_KEY: str
    S3_AWS_ACCESS_KEY_ID: str
    S3_AWS_SECRET_ACCESS_KEY: str

    PUBLIC_BASE_URL: str

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1].parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
    
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_AUTH_MAX: int = 5
    RATE_LIMIT_AUTH_WINDOW: int = 60
    RATE_LIMIT_CHAT_MAX: int = 30
    RATE_LIMIT_CHAT_WINDOW: int = 60
    RATE_LIMIT_BILLING_MAX: int = 10
    RATE_LIMIT_BILLING_WINDOW: int = 60
    IDEMPOTENCY_TTL: int = 3600 #1hr 
    LOCK_TIMEOUT: int = 30
    
    LANDING_PAGE_AGENT_ID: str
    BUCKET_NAME: str
    BUCKET_PUBLIC_URL: str = "https://bucket-image-tease-me.s3.us-east-1.amazonaws.com"
    INFLUENCER_BUCKET_PREFIX: str
    USER_PREFIX: str = "user-content"  # Default fallback if missing in .env
    S3_PRESIGNED_URL_TTL_SECONDS: int = 3600
    ASSET_PRESENCE_CACHE_TTL_SECONDS: int = 120
    ASSET_URL_CACHE_TTL_SECONDS: int = 300

    TWITTER_BEARER_TOKEN: str | None = None



    # External checkout webhook (Stripe/PayPal payment confirmation)
    PAYMENT_WEBHOOK_SECRET: str | None = None

    FIRSTPROMOTER_TOKEN: str | None = None
    FIRSTPROMOTER_ACCOUNT_ID: str | None = None
    FIRSTPROMOTER_API_KEY: str | None = None
    FIRSTPROMOTER_API_BASE_URL: str = "https://v2.firstpromoter.com/api/v2"
    FIRSTPROMOTER_API_V1_BASE_URL: str = "https://firstpromoter.com/api/v1"
    FIRSTPROMOTER_COMPANY_API_BASE_URL: str = "https://api.firstpromoter.com/api/v2"
    FIRSTPROMOTER_NOTIFY_EMAIL: str | None = None

    # Didit Identity Verification (v3 API)
    DIDIT_BASE_URL: str = "https://verification.didit.me/v3"
    DIDIT_API_KEY: str | None = None  # x-api-key for v3 API
    DIDIT_WEBHOOK_SECRET: str | None = None  # Webhook secret key from Didit console
    DIDIT_WORKFLOW_ID_KYC: str | None = None  # KYC workflow ID from Didit console
    DIDIT_REDIRECT_URL: str | None = None  # Default redirect URL after verification

    # External Checkout (tmservice)
    TMSERVICE_API_URL: str = "https://api.tmservice.live"
    TMSERVICE_API_KEY: str | None = None
    TMSERVICE_CIPHER_KEY: str = "TEASEME"  # Vigenère cipher key for password obfuscation
    TMSERVICE_REDIRECT_URL: str = "https://localhost:3000/home"

    # Logging configuration
    APP_ENV: str = "local"  # local | staging | production
    LOG_FILE_PATH: str = "./logs/app.log"
    LOG_LEVEL: str | None = None
    LOG_TO_CONSOLE: bool = True

    # Country detection
    GEO_BLOCKED_COUNTRY_CODES: str = ""
    AGE_VERIFICATION_REQUIRED_COUNTRY_CODES: str = ""
    GEO_COUNTRY_HEADER_PRIORITY: str = (
        "CF-IPCountry,CloudFront-Viewer-Country,X-Country-Code"
    )
    MAXMIND_DB_PATH: str = ""
    TRUST_X_FORWARDED_FOR: bool = True

    # LLM configuration
    DEFAULT_SUMMARIZATION_MODEL: str = "gpt-3.5-turbo"

    # Telegram Userbot (pytgcalls) configuration
    TELEGRAM_API_ID: int | None = None              # From https://my.telegram.org
    TELEGRAM_API_HASH: str | None = None            # From https://my.telegram.org
    TELEGRAM_SESSION_ENCRYPTION_KEY: str | None = None  # Fernet key for session file encryption
    TELEGRAM_USERBOT_ENABLED: bool = False           # Feature flag to enable/disable
    TELEGRAM_SESSIONS_DIR: str = "./telegram_sessions"
    FRONTEND_URL: str = "https://www.teaseme.live"  # Web app base URL

settings = Settings()
