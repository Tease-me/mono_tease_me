# Backend Architecture and Docs Organization

This document defines the required backend organization pattern and documentation taxonomy for this repository.

## Purpose

The goals of this pattern are:

- keep API route files thin and predictable
- isolate orchestration logic in use-cases
- isolate persistence and filesystem access in repositories
- keep response contracts deterministic and easy to review

This document is the source of truth for new backend feature organization.

## Non-goals

The following are explicitly out of scope for route files and should be rejected in review:

- business logic in route handlers
- direct SQL in route handlers
- filesystem/network orchestration inside repository modules

## Layering Contract (Mandatory)

Use these rules with MUST / MUST NOT semantics.

### `app/api/*` (HTTP layer)

- MUST handle HTTP concerns only:
  - auth and authorization checks
  - request parsing and query/path/body handling
  - status-code mapping (`HTTPException`)
- MUST call use-case functions for business flows.
- MUST map domain/use-case exceptions to HTTP responses.
- MUST NOT contain raw SQL.
- MUST NOT contain complex orchestration logic.

### `app/use_cases/*` (orchestration layer)

- MUST contain:
  - orchestration and flow control
  - validation and policy decisions
  - structured start/done/failure logging
  - error taxonomy for route mapping
- SHOULD return typed dataclass/DTO results with `as_dict()`.
- MUST NOT contain raw SQL statements.
- MUST NOT raise `HTTPException`.

### `app/repositories/*` (data access layer)

- MUST contain direct data-access logic only (DB/FS primitives).
- MUST be reusable and framework-agnostic.
- MUST NOT raise `HTTPException`.
- MUST NOT contain cross-service orchestration.

## Naming Conventions

- Routes: `app/api/<domain>.py`
  - Example: `app/api/admin.py`
- Use-cases: `app/use_cases/<feature>.py`
  - Example: `app/use_cases/admin_history_cleanup.py`
- Repositories: `app/repositories/<feature>_repository.py`
  - Example: `app/repositories/history_cleanup_repository.py`
- Errors:
  - `<Feature>ValidationError`
  - `<Feature>Error`
  - `<Feature>NotFoundError`
- Result DTO/dataclass:
  - `<Feature>Result`
  - include `as_dict()` for response serialization

## Standard Feature Template (Required Sequence)

When implementing a new backend feature:

1. Create repository functions for pure persistence/FS operations.
2. Create use-case orchestrator with typed result DTO and explicit errors.
3. Add thin API endpoint that only maps HTTP concerns.
4. Add frontend-facing API doc in `docs/` when contract changes or new endpoint is added.
5. Run compile/lint checks.
6. Add or update tests for route + use-case + repository behavior.

## Documentation Taxonomy

### File purpose by location

- `docs/ARCHITECTURE.md`
  - architecture rules, naming, review checklist, adoption plan
- `docs/MAKEFILE_USAGE.md`
  - operational commands only
- `docs/*-api-frontend.md`
  - frontend integration guides per endpoint family
- `docs/logging_guidelines.md`
  - logging format, redaction, and logging practices
- `docs/prompt-samples/*`
  - prompt samples/content only (not architecture or endpoint contract docs)

### Naming rules

- Use `kebab-case` for docs filenames.
- Frontend API docs MUST use `-api-frontend.md` suffix.
- One feature family per frontend API doc file.

## PR Architecture Checklist (Required)

Every PR that adds/changes backend features must satisfy:

- [ ] Route is thin and maps HTTP concerns only.
- [ ] No SQL/FS access is implemented in route file.
- [ ] Use-case contains orchestration and explicit error taxonomy.
- [ ] Repository layer is pure and reusable.
- [ ] Frontend API doc is added/updated if contract changed.
- [ ] Tests are added/updated for behavior changes.
- [ ] Structured start/done/failure logs are present for admin/ops-sensitive flows.

Reviewers should block PRs that fail this checklist.

## Real Repository Examples

Use these files as reference implementations:

- Pair cleanup orchestration:
  - `app/use_cases/admin_history_cleanup.py`
- Chat info orchestration:
  - `app/use_cases/admin_chat_info.py`
- Repository split:
  - `app/repositories/history_cleanup_repository.py`
  - `app/repositories/admin_chat_info_repository.py`
- Thin route mapping:
  - `app/api/admin.py`

## Anti-patterns (Reject in Review)

- route handlers containing SQL `select/delete/update`
- repositories raising `HTTPException`
- use-cases returning ad-hoc dicts with inconsistent schema
- endpoint contract changes without frontend doc updates

## Rollout and Adoption

### Immediate policy

- All new features MUST follow this architecture pattern.

### Incremental migration

- Existing legacy endpoints are migrated when touched.
- Do not perform broad refactors without product need.

### Review gate

- Architecture checklist is mandatory in code review.
- Reviewer blocks merge if checklist is not met.

## Quality Scenarios

1. A new admin endpoint PR cleanly maps route/use-case/repository boundaries.
2. API contract changes include corresponding `docs/*-api-frontend.md` update.
3. PRs with business logic in routes are rejected.
4. A new engineer can implement a feature from this document + examples.
5. Different features converge on consistent error/result patterns.
