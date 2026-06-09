from __future__ import annotations

import logging

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

log = logging.getLogger(__name__)

AWS_REGION = settings.AWS_REGION
SES_SENDER = settings.SES_SENDER
AWS_ACCESS_KEY_ID = settings.SES_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY = settings.SES_AWS_SECRET_ACCESS_KEY


def send_email_via_ses(
    to_email: str,
    subject: str,
    body_html: str,
    body_text: str | None = None,
):
    try:
        ses_client = boto3.client(
            "ses",
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )

        response = ses_client.send_email(
            Source=SES_SENDER,
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Html": {"Data": body_html, "Charset": "UTF-8"},
                    "Text": {"Data": body_text or subject, "Charset": "UTF-8"},
                },
            },
        )
        return response
    except ClientError as exc:
        log.error("Failed to send email via SES to %s: %s", to_email, exc)
        return None
    except Exception as exc:
        log.error("Unexpected error sending email to %s: %s", to_email, exc)
        return None
