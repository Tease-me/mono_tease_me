# Production Deploy

Production uses two separate paths:

| App | Host | Trigger |
|-----|------|---------|
| Frontend | AWS Amplify | Push or merge to `main` |
| Backend | EC2 (Docker) | PR merged to `main`, or manual workflow |

Recommended branch flow:

```text
dev → staging (auto-deploy staging) → main (auto-deploy production)
```

---

## Frontend — AWS Amplify

The frontend is a static Vite build deployed through Amplify.

### One-time monorepo setup

1. Open **AWS Amplify Console** → your TeaseMe app → **App settings** → **General**
2. Connect the repository to `Tease-me/mono_tease_me` instead of the old frontend repo
3. Set the production branch to `main`
4. Enable **Monorepo** and set **App root directory** to `apps/frontend`
5. Amplify will pick up the root `amplify.yml` in this repository

### Build settings

`amplify.yml` at the repo root runs:

```bash
yarn install --frozen-lockfile
yarn build
```

Artifacts are served from `apps/frontend/dist`.

### Environment variables

Set production `VITE_*` variables in the Amplify console (**Hosting** → **Environment variables**). At minimum:

- `VITE_APP_ENV=production`
- API and analytics keys your app expects (`VITE_API_URL`, PostHog, Sentry, etc.)

See [apps/frontend/README.md](apps/frontend/README.md) for the full env list.

### Maintenance mode

See [apps/frontend/docs/MAINTENANCE.md](apps/frontend/docs/MAINTENANCE.md).

---

## Backend — EC2 Docker

Production backend runs on EC2 with Docker Compose and connects to **AWS RDS** (no local Postgres container).

### One-time server setup

On the EC2 host:

```bash
mkdir -p "$HOME/teaseme-backend-starter/.cert"
```

Create the server-local files (never commit these):

```bash
$HOME/teaseme-backend-starter/.env          # DB_URL, secrets, APP_ENV=production
$HOME/teaseme-backend-starter/.cert/key.pem
$HOME/teaseme-backend-starter/.cert/cert.pem
```

Example `.env` entry:

```bash
DB_URL=postgresql+asyncpg://postgres:<password>@db-mjpro.cjag2o6ykz8c.ap-southeast-2.rds.amazonaws.com:5432/teaseme
APP_ENV=production
```

### GitHub self-hosted runner (EC2)

Register a runner on the monorepo with these labels:

```text
self-hosted, Linux, X64
```

Steps:

```bash
mkdir -p "$HOME/actions-runner" && cd "$HOME/actions-runner"
# Download and configure the runner for Tease-me/mono_tease_me
./config.sh --url https://github.com/Tease-me/mono_tease_me --token <TOKEN> \
  --labels self-hosted,Linux,X64
./svc.sh install && ./svc.sh start
```

Get the registration token from **GitHub → mono_tease_me → Settings → Actions → Runners → New self-hosted runner**.

### Deploy workflow

`.github/workflows/backend-deploy-production.yml` runs when:

- a PR into `main` is **merged** and touches `apps/backend/**`, or
- triggered manually via **Actions → Backend – Deploy Production → Run workflow**

The deploy script:

1. rsyncs `apps/backend/` into `$HOME/teaseme-backend-starter`
2. preserves server-local `.env` and `.cert`
3. runs `docker compose -f compose.production.yml up -d --build`

Override paths on the server if needed:

```bash
PRODUCTION_APP_DIR=/home/ubuntu/teaseme-backend-starter ./scripts/deploy-backend-production.sh
```

### Manual deploy (fallback)

```bash
cd "$HOME/teaseme-backend-starter"
docker compose -f compose.production.yml up -d --build
```

See also [apps/backend/docs/BACKUP.md](apps/backend/docs/BACKUP.md) and [apps/backend/docs/VERSION.md](apps/backend/docs/VERSION.md).

### Verify after deploy

```bash
curl https://api.teaseme.live/health/
docker compose -f compose.production.yml logs -f backend
```

---

## Checklist before first production deploy

- [ ] Amplify connected to `mono_tease_me`, app root `apps/frontend`, branch `main`
- [ ] Amplify production env vars set
- [ ] EC2 runner registered on `mono_tease_me` with labels `self-hosted,Linux,X64`
- [ ] `$HOME/teaseme-backend-starter/.env` and TLS certs in place on EC2
- [ ] Staging deploy verified (`dev` → `staging` merge)
- [ ] Production deploy tested via `workflow_dispatch` before relying on `main` merges
