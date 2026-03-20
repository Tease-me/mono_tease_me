from fastapi import APIRouter, Request

from app.utils.infrastructure.country import (
    extract_client_ip,
    get_request_country_context,
)

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/")
def health(request: Request):
    country = get_request_country_context(request)
    return {
        "ok": True,
        "country_allowed": not country["is_blocked"],
        "country_code": country["country_code"],
        "country_source_header": country["source_header"],
        "client_ip": extract_client_ip(request),
    }
