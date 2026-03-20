import logging
from ipaddress import ip_address
from pathlib import Path
from typing import TypedDict

from fastapi import Request
import maxminddb

from app.core.config import settings

log = logging.getLogger(__name__)

_reader: maxminddb.Reader | None = None
_reader_failed = False


class RequestCountryContext(TypedDict):
    country_code: str | None
    source_header: str | None
    is_blocked: bool


def _parse_csv_upper(value: str | None) -> set[str]:
    if not value:
        return set()
    return {
        part.strip().upper()
        for part in value.split(",")
        if part and part.strip()
    }


def _get_country_header_priority() -> list[str]:
    configured = settings.GEO_COUNTRY_HEADER_PRIORITY
    if not configured.strip():
        configured = "CF-IPCountry,CloudFront-Viewer-Country,X-Country-Code"
    return [header.strip() for header in configured.split(",") if header.strip()]


def _get_blocked_country_codes() -> set[str]:
    return _parse_csv_upper(settings.GEO_BLOCKED_COUNTRY_CODES)


def _normalize_country_code(value: str | None) -> str | None:
    if not value:
        return None
    normalized = value.strip().upper()
    if not normalized or len(normalized) != 2 or not normalized.isalpha():
        return None
    return normalized


def _is_public_ip(value: str | None) -> bool:
    if not value:
        return False
    try:
        parsed = ip_address(value)
    except ValueError:
        return False
    return not (
        parsed.is_private
        or parsed.is_loopback
        or parsed.is_link_local
        or parsed.is_multicast
        or parsed.is_reserved
        or parsed.is_unspecified
    )


def extract_client_ip(request: Request) -> str | None:
    if settings.TRUST_X_FORWARDED_FOR:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            first_ip = forwarded.split(",")[0].strip()
            if first_ip:
                return first_ip

    if request.client and request.client.host:
        return request.client.host.strip()
    return None


def _get_maxmind_reader() -> maxminddb.Reader | None:
    global _reader, _reader_failed

    if _reader is not None:
        return _reader
    if _reader_failed:
        return None

    db_path = (settings.MAXMIND_DB_PATH or "").strip()
    if not db_path:
        _reader_failed = True
        log.info("country_detection.maxmind_db_path_missing")
        return None

    path = Path(db_path)
    if not path.exists():
        _reader_failed = True
        log.warning("country_detection.maxmind_db_missing path=%s", path)
        return None

    try:
        _reader = maxminddb.open_database(str(path))
        return _reader
    except Exception as exc:
        _reader_failed = True
        log.warning("country_detection.maxmind_db_open_failed path=%s err=%s", path, exc)
        return None


def _lookup_country_from_ip(ip_value: str | None) -> str | None:
    if not _is_public_ip(ip_value):
        return None

    reader = _get_maxmind_reader()
    if reader is None or ip_value is None:
        return None

    try:
        record = reader.get(ip_value) or {}
    except Exception as exc:
        log.warning("country_detection.maxmind_lookup_failed ip=%s err=%s", ip_value, exc)
        return None

    country = record.get("country") or {}
    return _normalize_country_code(country.get("iso_code"))


def extract_country_code_from_request(request: Request) -> str | None:
    for header_name in _get_country_header_priority():
        raw_value = request.headers.get(header_name)
        normalized = _normalize_country_code(raw_value)
        if normalized:
            return normalized

    ip_value = extract_client_ip(request)
    geoip_country = _lookup_country_from_ip(ip_value)
    if geoip_country:
        return geoip_country

    log.info(
        "country_detection.missing headers=%s path=%s ip=%s",
        ",".join(_get_country_header_priority()),
        request.url.path,
        ip_value,
    )
    return None


def get_request_country_context(request: Request) -> RequestCountryContext:
    blocked = _get_blocked_country_codes()
    for header_name in _get_country_header_priority():
        raw_value = request.headers.get(header_name)
        normalized = _normalize_country_code(raw_value)
        if normalized:
            return {
                "country_code": normalized,
                "source_header": header_name,
                "is_blocked": normalized in blocked,
            }

    ip_value = extract_client_ip(request)
    geoip_country = _lookup_country_from_ip(ip_value)
    if geoip_country:
        return {
            "country_code": geoip_country,
            "source_header": "maxmind",
            "is_blocked": geoip_country in blocked,
        }

    return {
        "country_code": None,
        "source_header": None,
        "is_blocked": False,
    }


def is_request_from_blocked_country(request: Request) -> bool:
    return get_request_country_context(request)["is_blocked"]


def is_request_country_allowed(request: Request) -> bool:
    return not is_request_from_blocked_country(request)
