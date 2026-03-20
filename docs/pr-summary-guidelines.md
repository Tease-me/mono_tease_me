# PR Summary Guidelines

Use this guide when writing pull request summaries for backend changes in this repository.

## Goal

PR summaries should be:

- short enough to scan quickly
- grouped by behavior, not raw commit history
- written for reviewers who want impact first
- reusable across feature PRs and grouped merge summaries

## Recommended Structure

Use this order:

### 1. TL;DR

Write the TL;DR as bullets, not a paragraph.

Rules:

- keep it to 1-3 bullets
- each bullet should describe a major outcome
- focus on user-facing, reviewer-facing, or ops-facing impact
- avoid commit names like `fix`, `hotfix`, or `lint`

Example:

- Improves call reliability with polling fallback and better conversation handling.
- Improves prompt quality with timezone-aware context, memory updates, and username fixes.
- Adds admin analytics and a one-off tool for safely renaming influencer IDs.

### 2. Summary

Add one short paragraph explaining what the PR bundles together.

Example:

This PR bundles backend improvements across call handling, prompt quality, analytics, and operational tooling.

### 3. Key Changes

List the meaningful grouped changes.

Rules:

- group by feature area
- prefer behavior over file names
- mention tooling or ops changes only if they matter to usage or maintenance
- keep each bullet to one idea

Example:

- Added call polling with fallback handling to improve reliability around call and conversation updates.
- Improved memory and relationship-quality behavior, including updates in memory flow, turn handling, and embeddings logic.
- Added timezone and location context into mood prompting so prompts can better reflect the user’s local context.
- Added admin user analytics support, including the new analytics use case and related API wiring.
- Fixed missing username injection in prompt handling for the 18+ turn flow.
- Added a one-off influencer ID rename script plus a `Makefile` entry to run it more safely in ops workflows.

### 4. Included Merges

Only include this section when summarizing multiple merged branches.

Rules:

- list PR numbers or branch names only when useful for traceability
- keep the labels human-readable
- do not repeat details already covered in `Key Changes`

Example:

- `#388` call polling fallback
- `#391` memory / relevance improvements
- `#392` timezone in prompt
- `#393` analytics user
- influencer ID rename script and Make target
- follow-up username prompt fix

## Writing Rules

- Start with impact, not implementation detail.
- Do not copy raw commit messages into the PR body.
- Avoid filler sections like "minor fixes" unless they matter.
- Mention lint/editor cleanup only as a trailing note, never as the headline.
- If the PR is narrow, omit `Included Merges`.
- If the PR is broad, keep `Summary` short and let `Key Changes` carry the detail.

## Copyable Template

```md
### TL;DR
- <major outcome 1>
- <major outcome 2>
- <major outcome 3>

### Summary
<1 short paragraph>

### Key Changes
- <grouped change 1>
- <grouped change 2>
- <grouped change 3>

### Included Merges
- <PR or branch reference 1>
- <PR or branch reference 2>
```

## When To Use

- Use this full structure for grouped merge summaries and multi-feature PRs.
- For small PRs, keep only `TL;DR` and `Key Changes`.
