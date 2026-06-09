import re
from datetime import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import health_router
from app.utils import version as version_module


def test_get_app_version_reads_pyproject(monkeypatch, tmp_path) -> None:
    pyproject = tmp_path / "pyproject.toml"
    pyproject.write_text('[tool.poetry]\nversion = "2.3.4"\n', encoding="utf-8")
    monkeypatch.setattr(version_module, "PYPROJECT_PATH", pyproject)
    version_module.get_app_version.cache_clear()

    assert version_module.get_app_version() == "2.3.4"


def test_get_app_version_prefers_app_version_env(monkeypatch, tmp_path) -> None:
    pyproject = tmp_path / "pyproject.toml"
    pyproject.write_text('[tool.poetry]\nversion = "2.3.4"\n', encoding="utf-8")
    monkeypatch.setattr(version_module, "PYPROJECT_PATH", pyproject)
    monkeypatch.setenv("APP_VERSION", "9.9.9")
    version_module.get_app_version.cache_clear()

    assert version_module.get_app_version() == "9.9.9"


def test_bump_version_increments_semver() -> None:
    assert version_module.bump_version("1.0.0", "patch") == "1.0.1"
    assert version_module.bump_version("1.0.0", "minor") == "1.1.0"
    assert version_module.bump_version("1.0.0", "major") == "2.0.0"


def test_bump_pyproject_version_updates_file(monkeypatch, tmp_path) -> None:
    pyproject = tmp_path / "pyproject.toml"
    pyproject.write_text('[tool.poetry]\nversion = "1.0.0"\n', encoding="utf-8")
    monkeypatch.setattr(version_module, "PYPROJECT_PATH", pyproject)
    version_module.get_app_version.cache_clear()

    new_version = version_module.bump_pyproject_version("patch")

    assert new_version == "1.0.1"
    assert re.search(r'version = "1\.0\.1"', pyproject.read_text(encoding="utf-8"))


def test_health_includes_version(monkeypatch) -> None:
    monkeypatch.setattr(
        health_router,
        "get_app_version",
        lambda: "1.2.3",
    )
    app = FastAPI()
    app.include_router(health_router.router)
    client = TestClient(app)

    response = client.get("/health/")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["version"] == "1.2.3"
    assert payload["ok"] is True
    datetime.fromisoformat(payload["timestamp"].replace("Z", "+00:00"))
