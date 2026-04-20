import hmac

from fastapi import Header, HTTPException

from app.core.config import settings


async def require_internal_token(
    x_internal_token: str | None = Header(default=None),
) -> None:
    expected = settings.MJFP_TOKEN
    if not expected:
        raise HTTPException(status_code=500, detail="MJ promoter token not configured")
    if not x_internal_token or not hmac.compare_digest(x_internal_token, expected):
        raise HTTPException(status_code=401, detail="Invalid MJ promoter token")
