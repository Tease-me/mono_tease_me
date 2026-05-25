# Deploy and Version Guide

How to bump the app version so the UI and deployed static assets show the correct release.

## How versioning works

- Source of truth: `"version"` in root `package.json`
- Frontend UI: injected at build time via `vite.config.ts`
- Static verification: generated into `public/version.json`, served as `/version.json`
- In-app display: fixed badge in the bottom-right corner, for example `v0.0.1`

Always bump the version before you build and deploy.

## Bump the version

Run these from the project root.

### Patch

`1.0.0` -> `1.0.1`

```bash
npm run version:patch
```

### Minor

`1.0.0` -> `1.1.0`

```bash
npm run version:minor
```

### Major

`1.0.0` -> `2.0.0`

```bash
npm run version:major
```

Each command updates:

1. Root `package.json`
2. Root `package-lock.json`
3. `public/version.json`

### Manual bump

Edit `"version"` in `package.json`, then run:

```bash
npm run version:sync
```

## Build and deploy

The version badge is baked into the frontend bundle, so a rebuild is required after every version bump.

Typical flow:

```bash
# local
npm run version:patch
git add package.json package-lock.json public/version.json
git commit -m "Bump version to X.Y.Z"
git push

# then build or deploy as usual
yarn build
```

For staging deployments, the existing deploy workflow rebuilds the app before reloading the hosted static server. See `docs/self-hosted-macos-staging.md`.

## Verify after deploy

### In the app

Check the version badge in the bottom-right corner.

### Static endpoint

```bash
curl https://your-domain.com/version.json
```

Expected:

```json
{
  "name": "tease-me",
  "version": "1.0.1"
}
```
