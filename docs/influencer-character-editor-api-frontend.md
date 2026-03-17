# Influencer Character Editor API Frontend Guide

This document describes the current backend APIs available for the influencer character editor UI.

It covers:
- listing influencer-scoped character editor data
- uploading and deleting influencer character assets
- uploading and deleting influencer sample audio
- the public character payload used for final frontend rendering

It also explicitly lists the editor capabilities that are **not** currently supported by the backend.

## 1. Editor List Endpoint

Use this endpoint to load the editor view for a specific influencer:

- `GET /admin/influencer/{influencer_id}/adult-characters`

### Response shape

Each item has this shape:

```json
{
  "id": 7,
  "slug": "nurse",
  "name": "Nurse",
  "description": "A caring medical roleplay character with a soft but confident bedside manner.",
  "short_description": null,
  "is_active": true,
  "display_order": 1,
  "base_lottie_text": "adult-characters/7/lottie.json",
  "photo_url": "https://signed.example.com/influencer/juliana/characters/7/photo.png",
  "photo_2x_url": "https://signed.example.com/influencer/juliana/characters/7/photo@2x.png",
  "video_mp4_url": "https://signed.example.com/influencer/juliana/characters/7/video.mp4",
  "video_webm_url": "https://signed.example.com/influencer/juliana/characters/7/video.webm",
  "video_preview_png_url": "https://signed.example.com/influencer/juliana/characters/7/video.png",
  "has_photo": true,
  "has_complete_video_set": true,
  "resolved_lottie_text": "adult-characters/7/lottie.json",
  "meta_json": {
    "theme": "medical"
  },
  "has_influencer_override": true
}
```

### Important fields

- `id`, `slug`, `name`, `description`, `short_description`
  - base character metadata for display
- `base_lottie_text`
  - raw base character lottie S3 key
- `resolved_lottie_text`
  - currently the same global lottie key; there is no influencer-specific lottie override
- `photo_url`, `photo_2x_url`, `video_mp4_url`, `video_webm_url`, `video_preview_png_url`
  - signed URLs for influencer-specific asset rendering
- `has_photo`
  - true only when the full photo set exists
- `has_complete_video_set`
  - true only when the full video set exists
- `meta_json`
  - current overlay metadata value, read-only today
- `has_influencer_override`
  - true when an `influencer_character_meta` row exists for this influencer + character pair

## 2. Upload Influencer Character Assets

Use:

- `POST /admin/influencer/{influencer_id}/adult-characters/{character_id}/assets`

### Request format

Send `multipart/form-data`.

Supported file fields:

- `photo`
- `photo_2x`
- `video_mp4`
- `video_webm`
- `video_preview_png`

You may upload any subset of these fields in a single request.

### Example `curl`

```bash
curl -X POST \
  "$API_BASE_URL/admin/influencer/juliana/adult-characters/7/assets" \
  -H "Authorization: Bearer $TOKEN" \
  -F "photo=@./photo.png" \
  -F "photo_2x=@./photo@2x.png" \
  -F "video_mp4=@./video.mp4" \
  -F "video_webm=@./video.webm" \
  -F "video_preview_png=@./video.png"
```

### Upload response shape

```json
{
  "influencer_id": "juliana",
  "character_id": 7,
  "photo_url": "https://signed.example.com/influencer/juliana/characters/7/photo.png",
  "photo_2x_url": "https://signed.example.com/influencer/juliana/characters/7/photo@2x.png",
  "video_mp4_url": "https://signed.example.com/influencer/juliana/characters/7/video.mp4",
  "video_webm_url": "https://signed.example.com/influencer/juliana/characters/7/video.webm",
  "video_preview_png_url": "https://signed.example.com/influencer/juliana/characters/7/video.png",
  "has_photo": true,
  "has_complete_video_set": true,
  "meta_json": {
    "theme": "medical"
  },
  "has_influencer_override": true
}
```

## 3. Delete Influencer Character Assets

Use:

- `DELETE /admin/influencer/{influencer_id}/adult-characters/{character_id}/assets/{asset_type}`

### Supported `asset_type` values

- `photo`
- `photo_2x`
- `video_mp4`
- `video_webm`
- `video_preview_png`
- `video`

Use `video` when the UI should remove the full grouped video set at once.

### Example grouped video delete

```bash
curl -X DELETE \
  "$API_BASE_URL/admin/influencer/juliana/adult-characters/7/assets/video" \
  -H "Authorization: Bearer $TOKEN"
```

### Delete response shape

The response has the same shape as the upload response and reflects the remaining asset state after deletion.

## 4. Sample Audio Endpoints

These endpoints support influencer sample audio in the same editor area.

### Upload sample

- `POST /admin/influencer/{influencer_id}/samples`

Request:
- `multipart/form-data`
- required field: `file`

Example response:

```json
{
  "id": "influencer/juliana/samples/sample-1.mp3",
  "s3_key": "influencer/juliana/samples/sample-1.mp3",
  "original_filename": "voice-sample.mp3",
  "content_type": "audio/mpeg",
  "url": "https://signed.example.com/influencer/juliana/samples/sample-1.mp3",
  "created_at": "2026-03-17T11:30:00.000000+00:00"
}
```

### Delete sample

- `DELETE /admin/influencer/{influencer_id}/samples/{sample_id}`

Example response:

```json
{
  "ok": true,
  "deleted_id": "influencer/juliana/samples/sample-1.mp3"
}
```

## 5. Public Rendering Endpoint

The frontend ultimately renders from:

- `GET /influencer/{influencer_id}/adult-characters`

### Public response item example

```json
{
  "id": 7,
  "slug": "nurse",
  "name": "Nurse",
  "description": "A caring medical roleplay character with a soft but confident bedside manner.",
  "short_description": null,
  "prompt_template": "You are playing the role of a flirtatious nurse. Stay in character, speak warmly, and keep the tone playful, intimate, and role-focused.",
  "is_active": true,
  "display_order": 1,
  "default_artwork_key": "adult-characters/7/default-artwork.png",
  "default_artwork_url": "https://signed.example.com/adult-characters/7/default-artwork.png",
  "lottie_text": "adult-characters/7/lottie.json",
  "lottie_text_url": "https://signed.example.com/adult-characters/7/lottie.json",
  "photo_url": "https://signed.example.com/influencer/juliana/characters/7/photo.png",
  "photo_2x_url": "https://signed.example.com/influencer/juliana/characters/7/photo@2x.png",
  "video_mp4_url": "https://signed.example.com/influencer/juliana/characters/7/video.mp4",
  "video_webm_url": "https://signed.example.com/influencer/juliana/characters/7/video.webm",
  "video_preview_png_url": "https://signed.example.com/influencer/juliana/characters/7/video.png",
  "has_photo": true,
  "has_complete_video_set": true,
  "meta_json": {
    "theme": "medical"
  },
  "has_influencer_override": true
}
```

### Rendering rules

- Prefer video when `has_complete_video_set` is `true`
  - use `video_preview_png_url` as the poster image
  - use both `video_mp4_url` and `video_webm_url` as video sources
- Otherwise use the influencer photo set when `has_photo` is `true`
  - use `photo_url` as the main image
  - use `photo_2x_url` for retina or `srcSet` support
- Otherwise fall back to the base character artwork:
  - `default_artwork_url`
- Use `lottie_text_url` to render or download the base lottie file if present

## 6. Not Yet Available

The current backend does **not** provide:

- an endpoint to update `meta_json`
- an endpoint to toggle `InfluencerCharacterMeta.is_active`
- an endpoint to save editor-only per-influencer metadata other than file assets
- an influencer-specific lottie override API

If the editor UI needs to:
- save custom overlay metadata
- toggle overlay state
- edit per-influencer lottie

then a new backend API should be created first. Do not assume `meta_json` is writable based on the read response.

## 7. Error Handling

Common responses:

- `400`
  - invalid asset type
  - empty uploaded file
  - no asset file provided
- `403`
  - non-admin access
- `404`
  - influencer not found
  - adult character not found
  - requested asset not found

Example error:

```json
{
  "detail": "Adult character not found"
}
```

## 8. Frontend Checklist

- Build the editor list view from `GET /admin/influencer/{influencer_id}/adult-characters`
- Treat `meta_json` as read-only until a dedicated save API exists
- Use multipart uploads for asset mutations
- Support grouped `video` deletion in the UI
- Use the public `GET /influencer/{influencer_id}/adult-characters` response as the source of truth for runtime rendering
