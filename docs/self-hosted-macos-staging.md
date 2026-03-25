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

Copy the launchd plist into `/Library/LaunchDaemons` and load it:

```bash
sudo cp deploy/macos/com.teaseme.staging-web.plist /Library/LaunchDaemons/com.teaseme.staging-web.plist
sudo launchctl bootstrap system /Library/LaunchDaemons/com.teaseme.staging-web.plist
sudo launchctl enable system/com.teaseme.staging-web
sudo launchctl kickstart -k system/com.teaseme.staging-web
```

The service runs `scripts/serve-dist.sh`, which serves the latest built `dist` directory over HTTP on port `4173`.

## 4. Allow the runner to restart the app service

The staging deploy step restarts the app service with `sudo -n launchctl kickstart -k system/com.teaseme.staging-web`.

Grant the runner user passwordless access for that command in `sudoers`. Example:

```text
runner ALL=(root) NOPASSWD: /bin/launchctl print system/com.teaseme.staging-web, /bin/launchctl setenv PORT *, /bin/launchctl kickstart -k system/com.teaseme.staging-web
```

Adjust the username if the runner does not run as `runner`.

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
sudo launchctl print system/com.teaseme.staging-web
curl http://localhost:4173
```

Check logs:

```bash
tail -f /tmp/tease-me-staging-web.log
```
