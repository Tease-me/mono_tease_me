# Self-Hosted macOS Runner and Staging App Service

This repo can deploy the `staging` branch to a self-hosted macOS runner that also serves the built frontend continuously.

## What runs on the Mac

- GitHub Actions runner as an always-on service
- Staging app service as a separate `launchd` service
- Built app served from `/Users/runner/tease-me-staging/dist` on port `4173`

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
mkdir -p /Users/runner/actions-runner
cd /Users/runner/actions-runner
```

Download and configure the GitHub self-hosted runner for this repository. When prompted for labels, include:

```text
self-hosted,macos,staging
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
mkdir -p /Users/runner/tease-me-staging
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

The workflow in `.github/workflows/lint.yml` does this on a push to `staging`:

1. Run checkout, install, build, and lint on the self-hosted runner.
2. Sync the checked out repo into `/Users/runner/tease-me-staging`.
3. Run `yarn install --frozen-lockfile` and `yarn build` in that fixed directory.
4. Restart `com.teaseme.staging-web` so it serves the new `dist` output.

PRs still build and lint on `ubuntu-latest`.

## 6. Verify after setup

Check the runner:

```bash
cd /Users/runner/actions-runner
./svc.sh status
```

Check the app service:

```bash
sudo launchctl print system/com.teaseme.staging-web
curl http://localhost:4173
```

Check logs:

```bash
tail -f /Users/runner/Library/Logs/tease-me-staging-web.log
```
