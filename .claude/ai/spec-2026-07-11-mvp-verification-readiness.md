---
date: 2026-07-11
author: Codex
status: approved
related_research:
  - .claude/ai/spec-2026-07-11-mvp-product-contract.md
  - CLAUDE.md
---

# MVP Verification and Readiness

## Goal

Define the checks and readiness work required for the DAG executor to consider the fetchable digest MVP complete.

## Non-Goals

- No production launch automation.
- No paid monitoring, analytics, or crash reporting.
- No app store packaging.
- No new CI system unless one already exists.

## Current System

Documented commands in `CLAUDE.md`:

```bash
cd backend && python3 -m pytest tests/ -v
pytest tests/ -v
cd backend && ANTHROPIC_API_KEY=your_key uvicorn main:app --reload --port 8000
```

The app has `package.json` scripts:

```bash
npm test
npm run start
npm run ios
npm run android
npm run web
```

There is no documented lint or typecheck script in `app/package.json`.

## Proposed Design

Treat MVP completion as a combination of automated tests, API contract checks, and documented run instructions.

### Required Automated Checks

Backend:

```bash
cd backend && python3 -m pytest tests/ -v
```

Root CLI regression:

```bash
pytest tests/ -v
```

App:

```bash
cd app && npm test -- --runInBand
```

If app tests require a different Jest invocation for Expo, use the project’s working `npm test` behavior and document the final command in the implementation summary.

### Manual Smoke Checks

With backend running and `ANTHROPIC_API_KEY` configured:

1. `GET /digest` returns a JSON list.
2. At least one returned story, if present, has two or more URLs.
3. App opens to digest.
4. Tapping a story opens results.
5. Results either show the four sections or a clear retryable error.

### Environment Readiness

Document or preserve:

- Backend requires `ANTHROPIC_API_KEY` for live `/analyze`.
- Backend may use `API_SECRET` for `/analyze` authorization.
- App sends `EXPO_PUBLIC_API_SECRET` as `X-API-Key` for analysis.
- `app/constants/api.ts` controls backend base URL.

Do not hardcode local-only URLs over the current deployed API base unless the implementation also documents how to switch environments.

### Artifact Expectations

DAG implementation should leave:

- updated tests for backend and app;
- passing verification output;
- any new plans/decompositions under `.claude/ai/`;
- no stale references claiming manual URL paste/search is MVP.

## Alternatives Considered

- Add lint/typecheck scripts before MVP: useful, but not required unless implementation changes make tests insufficient.
- Add `/health`: optional; useful for deployment smoke checks but not necessary for the core MVP path.
- Require live Anthropic analysis in automated tests: rejected; tests should mock external API calls.

## Acceptance Criteria

- Backend tests pass.
- Root CLI tests pass.
- App tests pass.
- Test suite does not make live RSS/article/Anthropic calls.
- README/CLAUDE/docs touched by implementation no longer describe manual URL/search as the MVP entry point.
- Implementation summary records skipped checks when commands are absent.

## Risks and Open Questions

- Live digest quality depends on external feeds and publisher fetchability; automated tests should mock these dependencies.
- Expo/Jest compatibility can be brittle. Keep tests focused on behavior and avoid snapshot-heavy assertions.

## Implementation Notes

Likely files:

- `CLAUDE.md` if command docs need updating.
- `BACKLOG.md` if deferred fallback/search/cache items should be recorded.
- Test files under `backend/tests/`, `tests/`, and `app/__tests__/`.

This spec should be used as the final DAG verification gate after backend and app implementation specs are complete.
