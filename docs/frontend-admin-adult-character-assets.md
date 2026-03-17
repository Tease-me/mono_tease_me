# Frontend Admin Adult Character Assets

This document explains how the frontend should manage and render global adult-character artwork and lottie assets.

It covers:
- global admin adult-character CRUD
- base asset upload for `default_artwork` and `lottie_text`
- public influencer character responses used for display

## Admin Catalog Endpoints

Use these endpoints to manage the global `adult_characters` catalog:

- `GET /admin/adult-characters`
- `POST /admin/adult-characters`
- `PATCH /admin/adult-characters/{character_id}`
- `DELETE /admin/adult-characters/{character_id}`

### Admin adult character response shape

```json
{
  "id": 7,
  "slug": "nurse",
  "name": "Horny Nurse",
  "description": "Long form description for the character.",
  "short_description": "Quick nurse teaser",
  "prompt_template": "Base prompt template",
  "default_artwork_key": "adult-characters/7/default-artwork.png",
  "default_artwork_url": "https://signed.example.com/adult-characters/7/default-artwork.png",
  "lottie_text": "adult-characters/7/lottie.json",
  "lottie_text_url": "https://signed.example.com/adult-characters/7/lottie.json",
  "is_active": true,
  "display_order": 1,
  "created_at": "2026-03-17T12:00:00Z",
  "updated_at": "2026-03-17T12:30:00Z"
}
```

### Field notes

- `default_artwork_key` and `lottie_text` are raw stored S3 keys.
- `default_artwork_url` and `lottie_text_url` are signed URLs meant for frontend rendering.
- `short_description` is intended for compact cards, lists, or picker UIs.
- `description` remains the long-form text field.

## Base Asset Upload Endpoint

Use this endpoint to upload or replace the global adult-character artwork and lottie file:

- `POST /admin/adult-characters/{character_id}/assets`

### Multipart fields

- `default_artwork`
- `lottie_text`

You can send either field by itself or both together.

### Example `curl`

```bash
curl -X POST \
  "$API_BASE_URL/admin/adult-characters/7/assets" \
  -H "Authorization: Bearer $TOKEN" \
  -F "default_artwork=@./default-artwork.png" \
  -F "lottie_text=@./lottie.json"
```

### Upload response

The response shape matches the admin adult character object and includes updated key fields plus signed display URLs.

## Public Influencer Character Endpoint

Use this endpoint to render adult characters for a specific influencer:

- `GET /influencer/{influencer_id}/adult-characters`

### Public response item example

```json
{
  "id": 7,
  "slug": "nurse",
  "name": "Horny Nurse",
  "description": "Long form description for the character.",
  "short_description": "Quick nurse teaser",
  "prompt_template": "Base prompt template",
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

### Important behavior

- `default_artwork_key` and `lottie_text` are still the raw stored keys.
- `default_artwork_url` and `lottie_text_url` are the frontend display URLs.
- `lottie_text` remains global on the base character.
- There is no per-influencer lottie override.

## Frontend Rendering Rules

- Use `default_artwork_url` to render the base character artwork.
- Use `lottie_text_url` to render or download the lottie file.
- If `default_artwork_url` is `null`, fall back to your existing placeholder/default artwork behavior.
- If `lottie_text_url` is `null`, do not try to render lottie content.
- Prefer `short_description` in compact UI.
- Fall back to `description` when `short_description` is `null`.
- Keep using the influencer-specific asset fields for photo/video rendering:
  - `photo_url`
  - `photo_2x_url`
  - `video_mp4_url`
  - `video_webm_url`
  - `video_preview_png_url`

## Error Handling

Expect these common responses:

- `400`
  - when `POST /admin/adult-characters/{character_id}/assets` is called without any asset file
- `403`
  - when a non-admin user calls admin endpoints
- `404`
  - when the target adult character does not exist

Example error:

```json
{
  "detail": "Adult character not found"
}
```

## Frontend Checklist

- Update admin character types to include:
  - `short_description`
  - `default_artwork_url`
  - `lottie_text_url`
- Update public influencer character types to include:
  - `short_description`
  - `default_artwork_url`
  - `lottie_text_url`
- Add base asset upload UI for:
  - `default_artwork`
  - `lottie_text`
- Render `default_artwork_url` and `lottie_text_url` instead of trying to use raw keys directly for display.
