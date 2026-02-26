import logging
import logging.config
import os
from pathlib import Path


def _env_default_level(app_env: str) -> str:
    if app_env == "production":
        return "INFO"
    if app_env == "staging":
        return "DEBUG"
    return "DEBUG"


def _as_bool(value: str | bool | None, default: bool = True) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def configure_logging() -> None:
    app_env = os.getenv("APP_ENV", "local").strip().lower() or "local"
    log_file_path = os.getenv("LOG_FILE_PATH", "./logs/app.log").strip() or "./logs/app.log"
    log_level = (os.getenv("LOG_LEVEL") or _env_default_level(app_env)).strip().upper()
    log_to_console = _as_bool(os.getenv("LOG_TO_CONSOLE", "true"), default=True)

    log_path = Path(log_file_path)
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_path.touch(exist_ok=True)

    console_format = "%(asctime)s %(levelname)s %(name)s: %(message)s"
    # Structured key=value format for production without extra dependencies.
    production_format = (
        'ts=%(asctime)s level=%(levelname)s logger=%(name)s msg="%(message)s"'
    )
    chosen_format = "production" if app_env == "production" else "console"

    handlers: dict[str, dict] = {
        "file": {
            "class": "logging.handlers.TimedRotatingFileHandler",
            "level": log_level,
            "formatter": chosen_format,
            "filename": str(log_path),
            "when": "midnight",
            "interval": 1,
            "backupCount": 14,
            "encoding": "utf-8",
        },
        "live_stream": {
            "class": "app.core.live_logs.LiveLogHandler",
            "level": log_level,
            "formatter": chosen_format,
        },
    }
    root_handlers = ["file", "live_stream"]
    if log_to_console:
        handlers["console"] = {
            "class": "logging.StreamHandler",
            "level": log_level,
            "formatter": chosen_format,
            "stream": "ext://sys.stdout",
        }
        root_handlers.append("console")

    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "console": {"format": console_format},
                "production": {"format": production_format},
            },
            "handlers": handlers,
            "loggers": {
                # Quiet noisy third-party debug/info logs while keeping app logs intact.
                "botocore": {"level": "WARNING", "propagate": True},
                "boto3": {"level": "WARNING", "propagate": True},
                "urllib3": {"level": "WARNING", "propagate": True},
                "s3transfer": {"level": "WARNING", "propagate": True},
                "httpx": {"level": "WARNING", "propagate": True},
                "httpcore": {"level": "WARNING", "propagate": True},
                "openai": {"level": "WARNING", "propagate": True},
                "hpack": {"level": "WARNING", "propagate": True},
                "hpack.hpack": {"level": "WARNING", "propagate": True},
            },
            "root": {"handlers": root_handlers, "level": log_level},
        }
    )
