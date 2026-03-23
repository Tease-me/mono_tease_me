from pathlib import Path

from starlette.requests import Request

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
