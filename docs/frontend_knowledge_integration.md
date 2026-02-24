# Frontend KB Admin Integration

## Purpose and Scope
This guide defines frontend integration for influencer Knowledge Base (KB) admin management.

In scope:
- KB CRUD UI for admin users
- API integration for create/update, read, delete
- Validation, error handling, and QA behavior

Out of scope:
- Chat runtime internals
- 18+ flow
- ElevenLabs flow

## Prerequisites
- Admin-authenticated session is active.
- Frontend has backend base URL configured.
- Influencer must exist before KB operations.
- Frontend already sends auth token/header used by admin routes.

## API Surface
Admin-only endpoints (non-admin receives `403`):
1. `PUT /admin/influencers/{influencer_id}/knowledge`
2. `GET /admin/influencers/{influencer_id}/knowledge`
3. `DELETE /admin/influencers/{influencer_id}/knowledge`

## Endpoint Contracts

### PUT `/admin/influencers/{influencer_id}/knowledge`
Create or replace influencer knowledge and re-index chunks.

Path params:
- `influencer_id: string` (required)

Request body:
```json
{
  "text": "Long-form knowledge text for this influencer."
}
```

Success `200`:
```json
{
  "ok": true,
  "influencer_id": "anna",
  "document_id": 12,
  "chunk_count": 24,
  "updated_at": "2026-02-24T18:12:44.102938+00:00"
}
```

Errors:
- `400`: invalid/empty text
- `403`: admin-only
- `404`: influencer not found
- `500`: indexing/upsert failure

### GET `/admin/influencers/{influencer_id}/knowledge`
Fetch current knowledge text and metadata.

Path params:
- `influencer_id: string` (required)

Success `200`:
```json
{
  "ok": true,
  "influencer_id": "anna",
  "document_id": 12,
  "text": "Long-form knowledge text for this influencer.",
  "text_hash": "e5f4f56f...",
  "chunk_count": 24,
  "updated_at": "2026-02-24T18:12:44.102938+00:00"
}
```

Errors:
- `403`: admin-only
- `404`: influencer not found or no knowledge exists

### DELETE `/admin/influencers/{influencer_id}/knowledge`
Delete influencer knowledge document and chunks.

Path params:
- `influencer_id: string` (required)

Success `200`:
```json
{
  "ok": true,
  "influencer_id": "anna",
  "deleted": true
}
```

Errors:
- `403`: admin-only
- `404`: influencer not found or no knowledge exists
- `500`: delete failure

## Suggested Frontend Types (TypeScript)
```ts
export interface KnowledgeUpsertRequest {
  text: string;
}

export interface KnowledgeUpsertResponse {
  ok: boolean;
  influencer_id: string;
  document_id: number;
  chunk_count: number;
  updated_at?: string | null;
}

export interface KnowledgeGetResponse {
  ok: boolean;
  influencer_id: string;
  document_id: number;
  text: string;
  text_hash?: string | null;
  chunk_count: number;
  updated_at?: string | null;
}

export interface KnowledgeDeleteResponse {
  ok: boolean;
  influencer_id: string;
  deleted: boolean;
}

export interface ApiErrorShape {
  detail?: string;
}
```

## Recommended UI Flow
1. On page load, call `GET /admin/influencers/{influencer_id}/knowledge`.
2. If `200`, populate textarea with `text`.
3. If `404` (knowledge missing), show empty state: `No knowledge yet`.
4. On Save, call `PUT` with current textarea content.
5. On successful save, show confirmation and metadata (`chunk_count`, `updated_at`).
6. On Delete, show confirmation modal, then call `DELETE`.
7. On successful delete, clear textarea and return to empty state.

## Error Handling Matrix
- `400`: show inline validation near textarea (`Knowledge text is required`).
- `403`: show permission error (`Admin only`) and disable write actions.
- `404`:
  - influencer not found: show not-found state for influencer
  - knowledge not found: show create-ready empty state
- `500`: show retryable error and keep unsaved textarea content intact.

## Validation Rules
- Require non-empty text before calling `PUT`.
- Do not mutate/normalize text on client side.
- Disable Save/Delete while request is in-flight.
- Prevent duplicate submits.

## Operational Notes
- `PUT` can take longer than normal CRUD because server rebuilds chunks + embeddings.
- Use visible loading/progress state for save.
- Preserve local textarea value on failure so user can retry.

## QA Checklist
- Create when KB absent.
- Update existing KB and verify `updated_at` changes.
- Refresh and verify latest text from `GET`.
- Delete and verify empty state appears.
- Verify non-admin gets `403` and actions are blocked.

## Test Cases and Scenarios
1. Create flow:
- No KB exists -> `PUT` succeeds -> UI shows success and `chunk_count`.

2. Read flow with empty state:
- `GET` returns `404` knowledge missing -> UI shows editable empty state.

3. Update flow:
- Existing KB loads -> user edits -> save succeeds -> metadata updates.

4. Delete flow:
- Confirm delete -> `DELETE` succeeds -> editor clears and empty state shown.

5. Permission handling:
- `403` response -> clear admin-only error displayed and actions disabled.

6. Server failure handling:
- `500` during `PUT` -> textarea content remains and retry path is available.

## Debug Examples (`curl`)
Replace:
- `BASE_URL` with your backend URL
- `TOKEN` with admin bearer token
- `INFLUENCER_ID` with actual influencer id

```bash
curl -X PUT "$BASE_URL/admin/influencers/$INFLUENCER_ID/knowledge" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text":"Long-form knowledge text for this influencer."}'
```

```bash
curl -X GET "$BASE_URL/admin/influencers/$INFLUENCER_ID/knowledge" \
  -H "Authorization: Bearer $TOKEN"
```

```bash
curl -X DELETE "$BASE_URL/admin/influencers/$INFLUENCER_ID/knowledge" \
  -H "Authorization: Bearer $TOKEN"
```

## Assumptions and Defaults
- Audience: frontend engineers building admin UI.
- Scope: KB admin APIs only.
- File path: `docs/frontend_knowledge_integration.md`.
- Existing frontend auth flow is reused.
- Save is explicit (no autosave).
