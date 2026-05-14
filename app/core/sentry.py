import logging

import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.logging import LoggingIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

log = logging.getLogger(__name__)


def init_sentry(
    dsn: str,
    app_env: str,
    traces_sample_rate: float,
    profiles_sample_rate: float,
    release: str | None,
    send_default_pii: bool,
) -> None:
    sentry_sdk.init(
        dsn=dsn,
        environment=app_env,
        release=release or None,
        integrations=[
            StarletteIntegration(transaction_style="endpoint"),
            FastApiIntegration(transaction_style="endpoint"),
            SqlalchemyIntegration(),
            LoggingIntegration(
                level=logging.WARNING,
                event_level=logging.ERROR,
            ),
        ],
        traces_sample_rate=traces_sample_rate,
        profiles_sample_rate=profiles_sample_rate,
        send_default_pii=send_default_pii,
    )
    log.info("Sentry initialised (env=%s, traces=%.2f)", app_env, traces_sample_rate)
