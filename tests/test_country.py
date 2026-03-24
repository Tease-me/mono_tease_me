from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.api.routes import health_router
from app.utils.infrastructure import country


def test_resolve_maxmind_db_path_keeps_absolute_path() -> None:
    absolute_path = Path("/tmp/GeoLite2-Country.mmdb")

    resolved = country._resolve_maxmind_db_path(str(absolute_path))

    assert resolved == absolute_path


def test_resolve_maxmind_db_path_uses_repo_root_for_relative_paths() -> None:
    relative_path = "data/geoip/GeoLite2-Country.mmdb"

    resolved = country._resolve_maxmind_db_path(relative_path)

    assert resolved == country.PROJECT_ROOT / relative_path


def test_get_maxmind_reader_returns_none_for_empty_path(monkeypatch) -> None:
    monkeypatch.setattr(country.settings, "MAXMIND_DB_PATH", "")
    monkeypatch.setattr(country, "_reader", None)
    monkeypatch.setattr(country, "_reader_failed", False)

    reader = country._get_maxmind_reader()

    assert reader is None
    assert country._reader_failed is True


def test_get_maxmind_reader_returns_none_for_missing_resolved_file(monkeypatch) -> None:
    monkeypatch.setattr(country.settings, "MAXMIND_DB_PATH", "data/geoip/missing.mmdb")
    monkeypatch.setattr(country, "_reader", None)
    monkeypatch.setattr(country, "_reader_failed", False)

    reader = country._get_maxmind_reader()

    assert reader is None
    assert country._reader_failed is True


def test_get_request_country_context_only_blocks_configured_blocked_countries(
    monkeypatch,
) -> None:
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/health",
            "headers": [(b"cf-ipcountry", b"AU")],
        }
    )
    monkeypatch.setattr(country.settings, "GEO_COUNTRY_HEADER_PRIORITY", "CF-IPCountry")
    monkeypatch.setattr(country.settings, "GEO_BLOCKED_COUNTRY_CODES", "US,CA")

    context = country.get_request_country_context(request)

    assert context["country_code"] == "AU"
    assert context["source_header"] == "CF-IPCountry"
    assert context["is_blocked"] is False


def test_age_verification_required_countries_are_checked_independently(
    monkeypatch,
) -> None:
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/auth/me",
            "headers": [(b"cf-ipcountry", b"AU")],
        }
    )
    monkeypatch.setattr(country.settings, "GEO_COUNTRY_HEADER_PRIORITY", "CF-IPCountry")
    monkeypatch.setattr(country.settings, "GEO_BLOCKED_COUNTRY_CODES", "")
    monkeypatch.setattr(
        country.settings,
        "AGE_VERIFICATION_REQUIRED_COUNTRY_CODES",
        "GB, AU",
    )

    assert country.get_request_country_context(request)["is_blocked"] is False
    assert country.is_request_from_age_verification_required_country(request) is True


def test_request_country_context_prefers_maxmind_over_header(monkeypatch) -> None:
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/auth/me",
            "headers": [(b"cf-ipcountry", b"GB")],
            "client": ("176.227.240.55", 1234),
        }
    )
    monkeypatch.setattr(country.settings, "GEO_COUNTRY_HEADER_PRIORITY", "CF-IPCountry")
    monkeypatch.setattr(country.settings, "GEO_BLOCKED_COUNTRY_CODES", "")
    monkeypatch.setattr(country, "_lookup_country_from_ip", lambda ip_value: "IN")

    context = country.get_request_country_context(request)

    assert context["header_country_code"] == "GB"
    assert context["header_source"] == "CF-IPCountry"
    assert context["maxmind_country_code"] == "IN"
    assert context["country_code"] == "IN"
    assert context["source_header"] == "maxmind"
    assert context["is_blocked"] is False


def test_request_country_context_falls_back_to_header_when_maxmind_missing(
    monkeypatch,
) -> None:
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/auth/me",
            "headers": [(b"cf-ipcountry", b"CA")],
            "client": ("176.227.240.55", 1234),
        }
    )
    monkeypatch.setattr(country.settings, "GEO_COUNTRY_HEADER_PRIORITY", "CF-IPCountry")
    monkeypatch.setattr(country, "_lookup_country_from_ip", lambda ip_value: None)

    context = country.get_request_country_context(request)

    assert context["header_country_code"] == "CA"
    assert context["maxmind_country_code"] is None
    assert context["country_code"] == "CA"
    assert context["source_header"] == "CF-IPCountry"


def test_blocked_country_uses_final_country(monkeypatch) -> None:
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/health",
            "headers": [(b"cf-ipcountry", b"GB")],
            "client": ("176.227.240.55", 1234),
        }
    )
    monkeypatch.setattr(country.settings, "GEO_COUNTRY_HEADER_PRIORITY", "CF-IPCountry")
    monkeypatch.setattr(country.settings, "GEO_BLOCKED_COUNTRY_CODES", "IN")
    monkeypatch.setattr(country, "_lookup_country_from_ip", lambda ip_value: "IN")

    context = country.get_request_country_context(request)

    assert context["header_country_code"] == "GB"
    assert context["country_code"] == "IN"
    assert context["is_blocked"] is True
    assert country.is_request_country_allowed(request) is False


def test_age_verification_uses_final_country(monkeypatch) -> None:
    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/auth/me",
            "headers": [(b"cf-ipcountry", b"GB")],
            "client": ("176.227.240.55", 1234),
        }
    )
    monkeypatch.setattr(country.settings, "GEO_COUNTRY_HEADER_PRIORITY", "CF-IPCountry")
    monkeypatch.setattr(
        country.settings,
        "AGE_VERIFICATION_REQUIRED_COUNTRY_CODES",
        "IN",
    )
    monkeypatch.setattr(country, "_lookup_country_from_ip", lambda ip_value: "IN")

    assert country.is_request_from_age_verification_required_country(request) is True


def test_country_debug_endpoint_returns_both_values_with_maxmind_precedence(
    monkeypatch,
) -> None:
    app = FastAPI()
    app.include_router(health_router.router)
    monkeypatch.setattr(country.settings, "GEO_COUNTRY_HEADER_PRIORITY", "CF-IPCountry")
    monkeypatch.setattr(country.settings, "GEO_BLOCKED_COUNTRY_CODES", "IN")
    monkeypatch.setattr(country, "_lookup_country_from_ip", lambda ip_value: "IN")
    client = TestClient(app)

    response = client.get(
        "/health/country-debug",
        headers={"CF-IPCountry": "GB", "X-Forwarded-For": "176.227.240.55"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "client_ip": "176.227.240.55",
        "header_country": "GB",
        "header_source": "CF-IPCountry",
        "maxmind_country": "IN",
        "final_country": "IN",
        "final_source": "maxmind",
        "country_allowed": False,
        "header_priority": ["CF-IPCountry"],
    }


def test_country_debug_endpoint_falls_back_to_header_when_maxmind_missing(
    monkeypatch,
) -> None:
    app = FastAPI()
    app.include_router(health_router.router)
    monkeypatch.setattr(country.settings, "GEO_COUNTRY_HEADER_PRIORITY", "CF-IPCountry")
    monkeypatch.setattr(country.settings, "GEO_BLOCKED_COUNTRY_CODES", "")
    monkeypatch.setattr(country, "_lookup_country_from_ip", lambda ip_value: None)
    client = TestClient(app)

    response = client.get(
        "/health/country-debug",
        headers={"CF-IPCountry": "CA", "X-Forwarded-For": "176.227.240.55"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "ok": True,
        "client_ip": "176.227.240.55",
        "header_country": "CA",
        "header_source": "CF-IPCountry",
        "maxmind_country": None,
        "final_country": "CA",
        "final_source": "CF-IPCountry",
        "country_allowed": True,
        "header_priority": ["CF-IPCountry"],
    }
