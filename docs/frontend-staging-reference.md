# Frontend Staging Deploy Reference

This document records the current frontend staging deployment model in this repository as of March 26, 2026. It is written for backend or ops agents that need to mirror the same deployment pattern on a self-hosted staging machine.

## Overview

The frontend staging deploy is a self-hosted GitHub Actions workflow that:

1. runs when a pull request into `staging` is merged
2. deploys into a fixed staging directory under the runner user’s home directory
3. preserves a server-local `.env` file outside the Git repo
4. builds the frontend with Vite inside that fixed directory
5. runs the built app under PM2
6. serves the built SPA with a Node server that falls back to `index.html` for client routes

The current frontend staging path is:

```bash
$HOME/tease-me-staging
```

The current staging port is:

```bash
4173
```

The current PM2 app name is:

```bash
tease-me-staging
```

## Runner And Workflow Trigger

The staging deploy workflow lives in:

```text
.github/workflows/deploy-staging.yml
```

Current trigger model:

- event: `pull_request`
- type: `closed`
- branch filter: `staging`
- deploy job runs only when `github.event.pull_request.merged == true`

Current runner labels:

```text
self-hosted
macOS
X64
```

The workflow does:

1. checkout repository
2. setup Node.js 20
3. run `yarn install --frozen-lockfile`
4. run `yarn build`
5. run `yarn lint`
6. run `./scripts/deploy-staging.sh`

Important detail:

- Yarn cache restore is intentionally disabled in the staging workflow because restoring the cache on the self-hosted runner was taking too long and provided poor value there.

## Target Directory And Env File

The deployed frontend is built in a fixed directory owned by the runner user:

```bash
$HOME/tease-me-staging
```

The server-local Vite env file is expected to live at:

```bash
$HOME/tease-me-staging/.env
```

This env file is not committed to the repository.

The deploy script preserves:

- `.env`
- `.env.*`

So these files survive the `rsync --delete` step on every deploy.

## Deploy Script Flow

The deploy script lives in:

```text
scripts/deploy-staging.sh
```

Current behavior:

1. determine source checkout:
   - `SOURCE_DIR="${GITHUB_WORKSPACE:-$(pwd)}"`
2. determine target deploy directory:
   - `TARGET_DIR="${STAGING_APP_DIR:-$HOME/tease-me-staging}"`
3. sync source into target with `rsync -a --delete`
4. exclude the following during sync:
   - `.git/`
   - `.env`
   - `.env.*`
   - `node_modules/`
   - `dist/`
5. run inside the target directory:
   - `yarn install --frozen-lockfile`
   - `yarn build`
6. verify PM2 exists for the runner user
7. run:
   - `pm2 startOrReload ... --only tease-me-staging --update-env`
   - `pm2 save`

This means the deployed app is always rebuilt in the fixed staging directory, not served directly from the GitHub Actions checkout path.

## PM2 Process Model

The PM2 ecosystem file lives in:

```text
deploy/pm2/ecosystem.staging.config.cjs
```

Current PM2 model:

- app name: `tease-me-staging`
- working directory: `$HOME/tease-me-staging`
- script: `./scripts/serve-dist.sh`
- env:
  - `PORT=4173`
  - `HOST=0.0.0.0`
  - `DIST_DIR=$HOME/tease-me-staging/dist`

Important detail:

- PM2 is not running the React source code
- PM2 is not running `vite`
- PM2 is running a server for the already-built `dist` output

This is the correct model for staging in this repo.

## SPA Serving Behavior

The serving entrypoint is:

```text
scripts/serve-dist.sh
```

That script launches:

```text
scripts/serve-dist.mjs
```

Current runtime behavior:

- serves static files from `dist`
- returns real files when they exist
- returns `index.html` for non-file client routes
- returns 404 for missing asset/file requests

This Node server replaced an earlier Python `http.server` approach. The Python server was removed because React Router paths were 404ing on refresh and direct navigation for routes other than `/`.

So the current staging server is intentionally SPA-aware.

## What Backend Should Mirror

If the backend agent wants to follow the same staging deployment pattern, it should mirror these operational choices:

- use a dedicated self-hosted staging workflow rather than sharing it with normal PR validation
- trigger deployment only on merged PRs into `staging`
- deploy into a fixed directory under `$HOME`, not an ephemeral CI checkout path
- preserve server-local `.env` files during sync
- run the staged app under a user-space process manager owned by the runner user
- make the runtime server appropriate for the application type

For backend specifically, “appropriate runtime server” means:

- do not just copy the frontend Node SPA server blindly
- use whatever process/runtime serves the backend correctly
- ensure the server behavior matches the app’s routing/protocol model

Concrete frontend choices the backend agent may want to mirror conceptually:

- workflow isolation
- fixed deploy directory
- env preservation during sync
- PM2-style persistent user-space process management
- staging-specific port and app name

Concrete frontend choices the backend agent should not copy literally unless they fit:

- `yarn build` as the build command
- `scripts/serve-dist.sh`
- `scripts/serve-dist.mjs`
- SPA fallback logic

Those are frontend-specific.

## Files That Are Source Of Truth

This reference is based on the current contents of:

- `.github/workflows/deploy-staging.yml`
- `scripts/deploy-staging.sh`
- `deploy/pm2/ecosystem.staging.config.cjs`
- `scripts/serve-dist.sh`
- `scripts/serve-dist.mjs`
- `docs/self-hosted-macos-staging.md`
