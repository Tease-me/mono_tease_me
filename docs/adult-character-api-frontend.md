# Adult Character API Frontend Notes

## Summary

Adult character payloads now include two content fields intended for frontend display and call/chat bootstrapping:

- `short_description: string | null`
- `first_messages: string[] | null`

These fields are available in both:

- admin adult character APIs
- influencer-facing adult character list APIs

## Frontend Impact

Use `short_description` as the compact card/list subtitle for an adult character.

Use `first_messages` as an optional pool of suggested opening lines. The frontend can:

- display one random suggestion in the UI
- show all suggestions in a picker
- send one selected value into downstream call/chat flows

If `first_messages` is `null` or empty, the frontend should behave as if there are no suggestions and fall back to existing behavior.

## Influencer API

Endpoint:

```http
GET /influencer/{influencer_id}/adult-characters
```

Relevant response shape:

```json
[
  {
    "id": 1,
    "slug": "nurse",
    "name": "Nurse",
    "description": "A caring medical roleplay character with a soft but confident bedside manner.",
    "short_description": "Soft bedside care with a teasing smile.",
    "first_messages": [
      "Hey, lie back for me and tell me where you want my attention first.",
      "You look tense already, sweetheart. Want your nurse to take over?",
      "Mmm, I have a little time before rounds. Tell me what kind of care you need."
    ],
    "prompt_template": "You are playing the role of a flirtatious nurse...",
    "is_active": true,
    "display_order": 1,
    "default_artwork_key": null,
    "default_artwork_url": null,
    "lottie_text": "influencer/bella/adult-characters/lotties/adultTitlePlaceholder.json",
    "lottie_text_url": "https://...",
    "photo_url": "https://...",
    "photo_2x_url": "https://...",
    "video_mp4_url": null,
    "video_webm_url": null,
    "video_preview_png_url": null,
    "has_photo": true,
    "has_complete_video_set": false,
    "meta_json": null,
    "has_influencer_override": false
  }
]
```

## Admin APIs

Endpoints:

```http
GET /admin/adult-characters
POST /admin/adult-characters
PATCH /admin/adult-characters/{character_id}
```

### Create payload

```json
{
  "slug": "nurse",
  "name": "Nurse",
  "description": "A caring medical roleplay character with a soft but confident bedside manner.",
  "short_description": "Soft bedside care with a teasing smile.",
  "first_messages": [
    "Hey, lie back for me and tell me where you want my attention first.",
    "You look tense already, sweetheart. Want your nurse to take over?"
  ],
  "prompt_template": "You are playing the role of a flirtatious nurse...",
  "default_artwork_key": null,
  "lottie_text": null,
  "is_active": true,
  "display_order": 1
}
```

### Patch payload

Only send fields being changed:

```json
{
  "short_description": "Soft bedside care with a teasing smile.",
  "first_messages": [
    "Hey, lie back for me and tell me where you want my attention first.",
    "You look tense already, sweetheart. Want your nurse to take over?"
  ]
}
```

### Admin response shape

```json
{
  "id": 1,
  "slug": "nurse",
  "name": "Nurse",
  "description": "A caring medical roleplay character with a soft but confident bedside manner.",
  "short_description": "Soft bedside care with a teasing smile.",
  "first_messages": [
    "Hey, lie back for me and tell me where you want my attention first.",
    "You look tense already, sweetheart. Want your nurse to take over?"
  ],
  "prompt_template": "You are playing the role of a flirtatious nurse...",
  "default_artwork_key": null,
  "default_artwork_url": null,
  "lottie_text": null,
  "lottie_text_url": null,
  "is_active": true,
  "display_order": 1,
  "created_at": "2026-03-17T00:00:00Z",
  "updated_at": "2026-03-17T00:00:00Z"
}
```

## UI Recommendations

- Character cards: show `name` and `short_description`; fall back to `description` if `short_description` is missing.
- Character detail or pre-call screen: show one suggested line from `first_messages` if available.
- Admin form:
  - keep `short_description` as a single text input or textarea
  - keep `first_messages` as a repeatable string list input
- Empty state:
  - if `first_messages` is `null`, hide suggestion UI
  - if `short_description` is `null`, use `description` or omit subtitle text

## TypeScript Shape

```ts
type AdultCharacter = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  short_description: string | null;
  first_messages: string[] | null;
  prompt_template: string;
  is_active: boolean;
  display_order: number;
  default_artwork_key: string | null;
  default_artwork_url: string | null;
  lottie_text: string | null;
  lottie_text_url: string | null;
};
```

## Compatibility Notes

- This is an additive API change.
- Existing clients remain valid if they ignore unknown fields.
- Frontend code should not assume `first_messages` is always present or non-empty.
