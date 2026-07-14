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
cd app && npm test -- --runInBand
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

The product contract referenced in this document has `status: approved`. That is
the durable UI/product approval record for this DAG, and it predates this final
verification task. No implementation task in this DAG may begin without that
approval remaining recorded.

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

With backend running, network access available, and `ANTHROPIC_API_KEY`
configured:

1. `GET /digest` returns a JSON list.
2. Every returned story has at least two URLs and at least two sources;
   `sources[n]` labels `urls[n]`, with both arrays in the same order. An empty
   list is valid and does not provide evidence for the per-story assertion.
3. App opens to digest.
4. Tapping a story opens results.
5. Results either show the four sections or a clear retryable error.

These checks are credential- and network-dependent. Record each as passed,
failed, or unavailable for the environment in which the gate runs. An
unavailable check is not an automated pass and must not be represented as one.

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

### `verified-mvp` Output Contract

`verified-mvp` is a behavioral guarantee, not a replacement for test output. It
is satisfied only when all of the following are true:

- The backend, root CLI, and Expo commands above exit successfully when run from
  their documented working directories.
- Those suites use test doubles at the RSS/search, article extraction
  (`fetch_article`/`fetch_all`), and Anthropic analyzer boundaries, so no live
  external request is part of an automated pass.
- Compatibility behavior remains covered: shared root fetcher/analyzer and CLI
  behavior, `GET /search`, and ordered `POST /analyze` URL handling.
- Digest filtering and client navigation preserve `sources` and `urls` as
  aligned, ordered pairs, and the Expo Router route object passes the ordered
  URL list as `JSON.stringify(story.urls)`.
- The approved product/UI contract was recorded before DAG implementation.
- Every manual smoke check that is available passes; every unavailable
  credential- or network-dependent check is recorded as unavailable rather than
  silently skipped or counted as passed.

The completion runner executes the three automated commands after this task.
Its successful results are the automated evidence for this contract. Until that
runner succeeds, or if any available manual smoke check fails, `verified-mvp`
must not be reported as satisfied.

### Final Gate Record

- Product/UI approval: recorded by the approved product contract dated
  2026-07-11, before this verification task.
- Automated suites: delegated to the required post-session completion runner;
  no live-service result is inferred by this document.
- Credential-dependent API smoke: unavailable in this task unless a real
  `ANTHROPIC_API_KEY` and network access are supplied.
- Device/simulator app smoke: unavailable in this task unless an interactive
  Expo target and reachable backend are supplied.
- Unavailable smoke checks remain release evidence to collect; they are not
  converted to automated passes.

## Alternatives Considered

- Add lint/typecheck scripts before MVP: useful, but not required unless implementation changes make tests insufficient.
- Add `/health`: optional; useful for deployment smoke checks but not necessary for the core MVP path.
- Require live Anthropic analysis in automated tests: rejected; tests should mock external API calls.

## Acceptance Criteria

- Backend tests pass.
- Root CLI tests pass.
- App tests pass.
- Test suite does not make live RSS/article/Anthropic calls.
- Compatibility paths and ordered source/URL pairing remain covered.
- README/CLAUDE/docs touched by implementation no longer describe manual URL/search as the MVP entry point.
- Implementation summary records skipped checks when commands are absent.
- Available manual smoke checks pass, while unavailable credential-dependent
  checks are explicitly recorded without being counted as passes.

## Risks and Open Questions

- Live digest quality depends on external feeds and publisher fetchability; automated tests should mock these dependencies.
- Expo/Jest compatibility can be brittle. Keep tests focused on behavior and avoid snapshot-heavy assertions.

## Implementation Notes

Likely files:

- `CLAUDE.md` if command docs need updating.
- `BACKLOG.md` if deferred fallback/search/cache items should be recorded.
- Test files under `backend/tests/`, `tests/`, and `app/__tests__/`.

This spec should be used as the final DAG verification gate after backend and app implementation specs are complete.
