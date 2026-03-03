from app.core.config import settings
from app.gateways.elevenlabs_naming import apply_environment_label


def test_apply_environment_label_by_app_env():
    original = settings.APP_ENV
    try:
        settings.APP_ENV = "production"
        assert apply_environment_label("Sophia") == "[Production] Sophia"

        settings.APP_ENV = "staging"
        assert apply_environment_label("Sophia") == "[Staging] Sophia"

        settings.APP_ENV = "local"
        assert apply_environment_label("Sophia") == "[Dev] Sophia"
    finally:
        settings.APP_ENV = original
