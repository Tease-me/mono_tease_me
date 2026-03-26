# Self-Hosted macOS Runner and Staging App Service

This repo can deploy the `staging` branch to a self-hosted macOS runner that also serves the built frontend continuously.

## What runs on the Mac

- GitHub Actions runner as an always-on service
- Staging app service as a PM2-managed process under the runner user
- Built app served from `$HOME/tease-me-staging/dist` on port `4173`

## 1. Install prerequisites

Install Node.js 20, Yarn 1.x, and Xcode command line tools on the Mac.

Install PM2 globally for the same macOS user that runs the GitHub runner:

```bash
npm install -g pm2
```

Verify:

```bash
node -v
yarn -v
python3 --version
pm2 -v
```

## 2. Configure the GitHub runner

Create a dedicated runner directory outside the repo, for example:

```bash
mkdir -p "$HOME/actions-runner"
cd "$HOME/actions-runner"
```

Download and configure the GitHub self-hosted runner for this repository. The runner should have these labels:

```text
self-hosted,macOS,X64
```

Install and start the runner as a service:

```bash
./svc.sh install
./svc.sh start
```

After this, the runner should appear as `Idle` in the GitHub repository runner settings.

## 3. Configure the staging app service

Create the fixed deployment directory:

```bash
mkdir -p "$HOME/tease-me-staging"
```

Put your server-local Vite env file in the deployed app root, for example:

```bash
$HOME/tease-me-staging/.env
```

The staging deploy script preserves `.env` and `.env.*` files in that directory, so they survive `rsync --delete` during deploys.

Initialize PM2 startup persistence for the runner user:

```bash
pm2 startup
pm2 save
```

The staging deploy script uses the PM2 app definition in `deploy/pm2/ecosystem.staging.config.cjs` and serves the built frontend via `scripts/serve-dist.sh`.

## 4. Allow the runner to restart the app service

The staging deploy step now manages the app with PM2:

```bash
pm2 list
STAGING_APP_DIR="$HOME/tease-me-staging" STAGING_PORT=4173 pm2 startOrReload deploy/pm2/ecosystem.staging.config.cjs --only tease-me-staging --update-env
pm2 save
```

No `sudoers` entry or `launchctl` management is required for the deploy path as long as PM2 is installed for the runner user.

## 5. Deployment flow

The repo now uses two workflows:

- `.github/workflows/lint.yml` for PR validation on opened, synchronized, and reopened pull requests
- `.github/workflows/deploy-staging.yml` for merged pull requests whose base branch is `staging`

The staging deploy workflow does this when a PR is merged into `staging`:

1. Run checkout, install, build, and lint on the self-hosted runner.
2. Sync the checked out repo into `$HOME/tease-me-staging` for the runner account.
3. Run `yarn install --frozen-lockfile` and `yarn build` in that fixed directory.
4. Start or reload the `tease-me-staging` PM2 process so it serves the new `dist` output.

PRs still build and lint on `ubuntu-latest`.

## 6. Verify after setup

Check the runner:

```bash
cd "$HOME/actions-runner"
./svc.sh status
```

Check the app service:

```bash
pm2 list
pm2 logs tease-me-staging --lines 50
curl http://localhost:4173
```

Check logs:

```bash
pm2 logs tease-me-staging
```
