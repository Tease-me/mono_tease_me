"""Generic AWS S3 gateway operations."""

from __future__ import annotations

import boto3

from app.core.config import settings

s3_client = boto3.client(
    "s3",
    aws_access_key_id=settings.S3_AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.SES_AWS_SECRET_ACCESS_KEY,
    region_name=getattr(settings, "AWS_REGION", None) or "us-east-1",
)


def upload_fileobj(file_obj, bucket: str, key: str, *, content_type: str | None = None) -> None:
    extra_args = {"ContentType": content_type} if content_type else None
    if extra_args:
        s3_client.upload_fileobj(file_obj, bucket, key, ExtraArgs=extra_args)
    else:
        s3_client.upload_fileobj(file_obj, bucket, key)


def put_object(
    *,
    bucket: str,
    key: str,
    body: bytes,
    content_type: str | None = None,
) -> None:
    params = {"Bucket": bucket, "Key": key, "Body": body}
    if content_type:
        params["ContentType"] = content_type
    s3_client.put_object(**params)


def get_object(*, bucket: str, key: str):
    return s3_client.get_object(Bucket=bucket, Key=key)


def get_object_bytes(*, bucket: str, key: str) -> bytes:
    obj = get_object(bucket=bucket, key=key)
    body = obj.get("Body")
    return body.read() if body else b""


def delete_object(*, bucket: str, key: str) -> None:
    s3_client.delete_object(Bucket=bucket, Key=key)


def list_objects(*, bucket: str, prefix: str) -> list[str]:
    resp = s3_client.list_objects_v2(Bucket=bucket, Prefix=prefix)
    return [obj["Key"] for obj in resp.get("Contents", [])]


def generate_presigned_get_url(*, bucket: str, key: str, expires: int = 3600) -> str:
    return s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires,
    )
