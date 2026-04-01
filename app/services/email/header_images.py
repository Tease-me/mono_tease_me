from __future__ import annotations

import io
import logging
import urllib.request
import uuid

from PIL import Image

from app.core.config import settings
from app.utils.storage.s3 import generate_user_presigned_url, s3

log = logging.getLogger(__name__)

_BUCKET_URL = settings.BUCKET_PUBLIC_URL.rstrip("/")
EMAIL_VERIFY_HEADER_URL = f"{_BUCKET_URL}/email_verify_header.png"
EMAIL_RESET_HEADER_URL = f"{_BUCKET_URL}/reset_password_header.png"
EMAIL_INFLUENCER_HEADER_BG_URL = f"{_BUCKET_URL}/influencer_header_background.png"
EMAIL_HEADER_SIZE = (520, 150)


def image_data_url(key: str) -> str:
    try:
        expires = 60 * 60 * 24 * 7
        url = generate_user_presigned_url(key, expires=expires)
        log.info(
            "image_data_url: generated presigned url bucket=%s key=%s expires=%s",
            settings.BUCKET_NAME,
            key,
            expires,
        )
        return url
    except Exception:
        log.exception(
            "image_data_url: failed to generate presigned url bucket=%s key=%s",
            settings.BUCKET_NAME,
            key,
            extra={"bucket": settings.BUCKET_NAME, "key": key},
        )
        raise


def _fetch_image_bytes_from_url(url: str) -> bytes:
    with urllib.request.urlopen(url, timeout=10) as resp:  # nosec - controlled URL
        return resp.read()


def _fetch_image_bytes_from_s3(key: str) -> bytes:
    obj = s3.get_object(Bucket=settings.BUCKET_NAME, Key=key)
    return obj["Body"].read()


def _image_cover(
    img: Image.Image,
    size: tuple[int, int],
    *,
    mode: str = "RGB",
) -> Image.Image:
    target_w, target_h = size
    img = img.convert(mode)
    src_w, src_h = img.size
    if src_w == 0 or src_h == 0:
        return Image.new(
            mode,
            size,
            (0, 0, 0, 0) if mode == "RGBA" else (0, 0, 0),
        )
    scale = max(target_w / src_w, target_h / src_h)
    new_w = int(round(src_w * scale))
    new_h = int(round(src_h * scale))
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = max(0, (new_w - target_w) // 2)
    top = max(0, (new_h - target_h) // 2)
    return img.crop((left, top, left + target_w, top + target_h))


def _resize_to_width(
    img: Image.Image,
    target_w: int,
    *,
    mode: str = "RGBA",
) -> Image.Image:
    img = img.convert(mode)
    w, h = img.size
    if w == 0 or h == 0:
        return Image.new(
            mode,
            (target_w, 1),
            (0, 0, 0, 0) if mode == "RGBA" else (0, 0, 0),
        )
    scale = target_w / w
    new_h = max(1, int(round(h * scale)))
    return img.resize((target_w, new_h), Image.LANCZOS)


def _image_fit_height_center(
    img: Image.Image,
    *,
    size: tuple[int, int],
    mode: str = "RGBA",
) -> Image.Image:
    target_w, target_h = size
    img = img.convert(mode)
    src_w, src_h = img.size
    if src_w == 0 or src_h == 0:
        return Image.new(
            mode,
            size,
            (0, 0, 0, 0) if mode == "RGBA" else (0, 0, 0),
        )

    scale = target_h / src_h
    new_w = int(round(src_w * scale))
    resized = img.resize((new_w, target_h), Image.LANCZOS)
    if new_w > target_w:
        left = (new_w - target_w) // 2
        return resized.crop((left, 0, left + target_w, target_h))

    canvas = Image.new(mode, (target_w, target_h), (0, 0, 0, 0))
    x = (target_w - new_w) // 2
    canvas.paste(resized, (x, 0))
    return canvas


def compose_email_header_image_url(
    *,
    photo_key: str,
    background_url: str,
    influencer_id: str,
) -> str:
    size = EMAIL_HEADER_SIZE
    try:
        log.info(
            "compose_email_header_image_url: composing header influencer_id=%s photo_key=%s",
            influencer_id,
            photo_key,
        )

        bg_raw = _fetch_image_bytes_from_url(background_url)
        photo_raw = _fetch_image_bytes_from_s3(photo_key)
        overlay_scaled = _resize_to_width(
            Image.open(io.BytesIO(bg_raw)),
            size[0],
            mode="RGBA",
        )

        alpha_scaled = overlay_scaled.split()[-1]
        hole_bbox_scaled = alpha_scaled.point(
            lambda a: 255 if a < 10 else 0
        ).getbbox()
        if not hole_bbox_scaled:
            hole_bbox_scaled = (60, 80, size[0] - 60, max(1, overlay_scaled.size[1] - 80))

        target_h = size[1]
        scaled_h = overlay_scaled.size[1]
        if scaled_h <= target_h:
            crop_top = 0
        else:
            hole_cy = (hole_bbox_scaled[1] + hole_bbox_scaled[3]) // 2
            crop_top = hole_cy - (target_h // 2)
            crop_top = max(0, min(crop_top, scaled_h - target_h))

        overlay = overlay_scaled.crop((0, crop_top, size[0], crop_top + target_h))
        hole_bbox = (
            hole_bbox_scaled[0],
            max(0, hole_bbox_scaled[1] - crop_top),
            hole_bbox_scaled[2],
            max(0, hole_bbox_scaled[3] - crop_top),
        )

        alpha = overlay.split()[-1]
        hole_bbox2 = alpha.point(lambda a: 255 if a < 10 else 0).getbbox()
        if hole_bbox2:
            hole_bbox = hole_bbox2
        if not hole_bbox:
            hole_bbox = (60, 80, size[0] - 60, size[1] - 80)

        hole_w = max(1, hole_bbox[2] - hole_bbox[0])
        hole_h = max(1, hole_bbox[3] - hole_bbox[1])
        photo_img = Image.open(io.BytesIO(photo_raw))
        photo_fit = _image_cover(photo_img, (hole_w, hole_h), mode="RGBA")

        base = Image.new("RGBA", size, (0, 0, 0, 255))
        hole_mask_full = Image.eval(alpha, lambda a: 255 - a)
        hole_mask = hole_mask_full.crop(hole_bbox)
        base.paste(photo_fit, (hole_bbox[0], hole_bbox[1]), mask=hole_mask)

        composed = Image.alpha_composite(base, overlay).convert("RGB")
        out = io.BytesIO()
        composed.save(out, format="JPEG", quality=90, optimize=True, progressive=True)
        out.seek(0)

        key = f"email-assets/headers/{influencer_id}/{uuid.uuid4()}.jpg"
        s3.upload_fileobj(
            out,
            settings.BUCKET_NAME,
            key,
            ExtraArgs={"ContentType": "image/jpeg"},
        )
        url = generate_user_presigned_url(key, expires=60 * 60 * 24 * 7)
        log.info("compose_email_header_image_url: uploaded header key=%s", key)
        return url
    except Exception:
        log.exception(
            "compose_email_header_image_url: failed to compose header influencer_id=%s photo_key=%s",
            influencer_id,
            photo_key,
        )
        raise


__all__ = [
    "EMAIL_HEADER_SIZE",
    "EMAIL_INFLUENCER_HEADER_BG_URL",
    "EMAIL_RESET_HEADER_URL",
    "EMAIL_VERIFY_HEADER_URL",
    "compose_email_header_image_url",
    "image_data_url",
]
