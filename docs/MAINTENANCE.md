# Frontend Maintenance Mode

## How It Works

A static `public/maintenance.html` page is included in every Amplify deployment.
To show it to all users, add a **Rewrite rule** in the Amplify console — no code changes or rebuilds required.

---

## Enabling Maintenance Mode

1. Go to **AWS Amplify Console** → select the app → **Hosting** → **Rewrites and Redirects**
2. Click **Add rewrite**
3. Fill in:

   | Field | Value |
   |-------|-------|
   | Source address | `/*` |
   | Target address | `/maintenance.html` |
   | Type | `200 (Rewrite)` |

4. Click **Save** — takes effect within seconds

All visitors (any URL) will now see the maintenance page.

Alternatively, you can paste this directly into the **JSON editor** in the Amplify console (add the maintenance rule **before** the existing rules so it takes priority):

```json
[
  {
    "source": "/<*>",
    "status": "200",
    "target": "/maintenance.html"
  },
  {
    "source": "https://teaseme.live",
    "status": "302",
    "target": "https://www.teaseme.live"
  },
  {
    "source": "/<*>",
    "status": "404-200",
    "target": "/index.html"
  }
]
```

---

## Disabling Maintenance Mode

In the Amplify console JSON editor, remove the maintenance rule and save:

```json
[
  {
    "source": "https://teaseme.live",
    "status": "302",
    "target": "https://www.teaseme.live"
  },
  {
    "source": "/<*>",
    "status": "404-200",
    "target": "/index.html"
  }
]
```

---

## Testing Locally

Run the dev server and open:

```
http://localhost:3000/maintenance.html
```

---

## Editing the Maintenance Page

The page is at [`public/maintenance.html`](public/maintenance.html).
It is self-contained HTML/CSS — no build step required. Edit and commit to deploy changes with the next build.
