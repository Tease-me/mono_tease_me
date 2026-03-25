# Self-Hosted macOS Runner and Staging App Service

This repo can deploy the `staging` branch to a self-hosted macOS runner that also serves the built frontend continuously.

## What runs on the Mac

- GitHub Actions runner as an always-on service
- Staging app service as a separate `launchd` service
- Built app served from `$HOME/tease-me-staging/dist` on port `4173`

## 1. Install prerequisites

Install Node.js 20, Yarn 1.x, and Xcode command line tools on the Mac.

Verify:

```bash
node -v
yarn -v
python3 --version
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

The deploy script can auto-install the launch agent if it is missing. If you want to preload it manually, use:

```bash
mkdir -p "$HOME/Library/LaunchAgents"
cp deploy/macos/com.teaseme.staging-web.plist "$HOME/Library/LaunchAgents/com.teaseme.staging-web.plist"
launchctl bootstrap "user/$(id -u)" "$HOME/Library/LaunchAgents/com.teaseme.staging-web.plist"
launchctl enable "user/$(id -u)/com.teaseme.staging-web"
launchctl kickstart -k "user/$(id -u)/com.teaseme.staging-web"
```

The service runs `scripts/serve-dist.sh`, which serves the latest built `dist` directory over HTTP on port `4173`.

## 4. Allow the runner to restart the app service

The staging deploy step now restarts the app service in the runner user’s launchd domain:

```bash
launchctl print "user/$(id -u)/com.teaseme.staging-web"
launchctl setenv PORT 4173
launchctl kickstart -k "user/$(id -u)/com.teaseme.staging-web"
```

No `sudoers` entry is needed as long as the GitHub runner and the launch agent both run under the same macOS user account.

If the service is missing during deployment, `scripts/deploy-staging.sh` now copies `deploy/macos/com.teaseme.staging-web.plist` into `~/Library/LaunchAgents/`, bootstraps it in `user/$(id -u)`, enables it, and then restarts it.

If the runner cannot use a user launchd domain, the deploy script also falls back to a system daemon at `/Library/LaunchDaemons/com.teaseme.staging-web.plist`. That fallback requires passwordless `sudo` for:

```text
/bin/launchctl print system/com.teaseme.staging-web
/bin/launchctl bootstrap system /Library/LaunchDaemons/com.teaseme.staging-web.plist
/bin/launchctl enable system/com.teaseme.staging-web
/bin/launchctl kickstart -k system/com.teaseme.staging-web
```

## 5. Deployment flow

The repo now uses two workflows:

- `.github/workflows/lint.yml` for PR validation on opened, synchronized, and reopened pull requests
- `.github/workflows/deploy-staging.yml` for merged pull requests whose base branch is `staging`

The staging deploy workflow does this when a PR is merged into `staging`:

1. Run checkout, install, build, and lint on the self-hosted runner.
2. Sync the checked out repo into `$HOME/tease-me-staging` for the runner account.
3. Run `yarn install --frozen-lockfile` and `yarn build` in that fixed directory.
4. Restart `com.teaseme.staging-web` so it serves the new `dist` output.

PRs still build and lint on `ubuntu-latest`.

## 6. Verify after setup

Check the runner:

```bash
cd "$HOME/actions-runner"
./svc.sh status
```

Check the app service:

```bash
launchctl print "user/$(id -u)/com.teaseme.staging-web"
curl http://localhost:4173
```

Check logs:

```bash
tail -f /tmp/tease-me-staging-web.log
```
