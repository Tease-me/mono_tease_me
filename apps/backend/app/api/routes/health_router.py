from datetime import UTC, datetime

from fastapi import APIRouter, Request

from app.utils.infrastructure.country import (
    _get_country_header_priority,
    extract_client_ip,
    get_request_country_context,
)
from app.utils.version import get_app_version

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("/")
def health(request: Request):
    country = get_request_country_context(request)
    return {
        "status": "ok",
        "version": get_app_version(),
        "timestamp": datetime.now(UTC).isoformat(),
        "ok": True,
        "country_allowed": not country["is_blocked"],
        "country_code": country["country_code"],
        "country_source_header": country["source_header"],
        "client_ip": extract_client_ip(request),
    }


@router.get("/country-debug")
def country_debug(request: Request):
    country = get_request_country_context(request)
    return {
        "ok": True,
        "client_ip": extract_client_ip(request),
        "header_country": country["header_country_code"],
        "header_source": country["header_source"],
        "maxmind_country": country["maxmind_country_code"],
        "final_country": country["country_code"],
        "final_source": country["source_header"],
        "country_allowed": not country["is_blocked"],
        "header_priority": _get_country_header_priority(),
    }
