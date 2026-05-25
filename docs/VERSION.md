# Deploy & Version Guide

How to bump the backend version and deploy so `/health` and the API docs show the correct release.

---

## How versioning works

| What                  | Where                                                               |
| --------------------- | ------------------------------------------------------------------- |
| **Source of truth**   | `version` in root `pyproject.toml` (`[tool.poetry]`)                |
| **Runtime reader**    | `app/utils/version.py`                                              |
| **OpenAPI / Swagger** | FastAPI app metadata (`/docs`)                                      |
| **Health check**      | `GET /health` returns `{ "status": "ok", "version": "1.0.0", ... }` |

Always bump the version **before** you build and deploy.

---

## Bump the version (local)

Run these from the **project root**.

### Patch — bug fixes, small changes

`1.0.0` → `1.0.1`

```bash
make version-patch
```

### Minor — new features, no breaking changes

`1.0.0` → `1.1.0`

```bash
make version-minor
```

### Major — breaking or large releases

`1.0.0` → `2.0.0`

```bash
make version-major
```

Each command updates `pyproject.toml`.

Equivalent without Make:

```bash
poetry run python scripts/bump_version.py patch   # or minor / major
```

### Manual bump

Edit `version` under `[tool.poetry]` in `pyproject.toml`.

### Commit the version change

```bash
git add pyproject.toml
git commit -m "Bump version to X.Y.Z"
git push
```

---

## Deploy to production

Typical flow after bumping the version:

```bash
# 1. On your machine — bump version (see above), commit, push

# 2. On the server
git pull origin <your-branch>
docker compose -f compose.production.yml up --build -d
```

See also: `docs/BACKUP.md` and your deployment runbooks.

**Important:** Rebuild the backend image after pulling. Restarting containers alone without a new build will not update the version baked into the running image.

---

## Verify after deploy

### Health endpoint

```bash
curl https://your-domain.com/health
```

Expected:

```json
{
  "status": "ok",
  "version": "1.0.1",
  "timestamp": "2026-05-25T12:00:00.000000+00:00",
  "ok": true,
  "country_allowed": true,
  "country_code": "AU",
  "country_source_header": "CF-IPCountry",
  "client_ip": "..."
}
```

### Server logs

On startup, the backend logs:

```text
App version: 1.0.1
```

### OpenAPI

Open `/docs` — the API title shows the same version string.

---

## Semver quick reference

| Change type     | Command              | Example           |
| --------------- | -------------------- | ----------------- |
| Bug fix         | `make version-patch` | `1.0.0` → `1.0.1` |
| New feature     | `make version-minor` | `1.0.0` → `1.1.0` |
| Breaking change | `make version-major` | `1.0.0` → `2.0.0` |

---

## Troubleshooting

**`/health` still shows the old version**

- You did not rebuild/redeploy after bumping.
- Server is running old code — confirm `git pull` and container rebuild.

**Override version without changing pyproject.toml** (rare)

Set on the server:

```bash
APP_VERSION=1.0.1
```

This affects the backend `/health` response, startup log, and the OpenAPI / Swagger version shown in `/docs`.
