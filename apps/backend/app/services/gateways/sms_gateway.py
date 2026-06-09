from __future__ import annotations

import logging
import re

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

log = logging.getLogger(__name__)

_E164_PATTERN = re.compile(r"^\+[1-9]\d{6,14}$")


def send_sms_via_sns(*, phone_number: str, message: str):
    normalized = phone_number.strip()
    if not _E164_PATTERN.fullmatch(normalized):
        log.warning("Skipping SMS: invalid E.164 phone number")
        return None

    try:
        sns_client = boto3.client(
            "sns",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.SES_AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.SES_AWS_SECRET_ACCESS_KEY,
        )
        return sns_client.publish(PhoneNumber=normalized, Message=message)
    except ClientError as exc:
        log.error("Failed to send SMS via SNS to %s: %s", normalized[:6] + "****", exc)
        return None
    except Exception as exc:
        log.error("Unexpected error sending SMS to %s: %s", normalized[:6] + "****", exc)
        return None
