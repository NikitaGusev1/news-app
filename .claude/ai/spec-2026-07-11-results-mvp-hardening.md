---
date: 2026-07-11
author: Codex
status: approved
related_research:
  - .claude/ai/spec-2026-07-11-mvp-product-contract.md
  - docs/superpowers/specs/2026-04-04-react-native-app-design.md
---

# Results MVP Hardening

## Goal

Keep the existing results screen as the MVP analysis experience, but harden it for the fetchable digest flow: malformed route params, transient analysis failures, partial source fetches, retry, and share output should behave predictably.

## Non-Goals

- No redesign of the four-section analysis UI.
- No streaming analysis.
- No saved result history.
- No story metadata dependency beyond URL params.
- No requirement to show article text.

## Current System

`app/app/(app)/results.tsx` currently:

- reads `urls` from Expo Router search params;
- calls `POST ${API_BASE}/analyze` on mount;
- includes `X-API-Key` from `process.env.EXPO_PUBLIC_API_SECRET ?? ''`;
- shows loading, error with Try again, warning when fewer sources were fetched than requested, four tabs, and share.

`backend/main.py` currently:

- returns 400 when fewer than two articles fetch successfully;
- returns `sections` and `meta` on success.

## Proposed Design

Keep the results route contract unchanged: results receives only `urls` as a JSON string. Digest story metadata stays on the digest screen; results is responsible only for analysis.

### Route Param Handling

- Parse `urls` safely.
- If parsing fails or the result is not an array of strings, treat it as an empty URL list and let the API return the standard error, or show a local `Invalid story` error before calling the API.
- Prefer local validation to avoid unnecessary network calls for malformed params.

### API Handling

- On non-2xx response, read JSON if possible and display `detail` when present.
- If JSON parsing fails, display `Analysis failed`.
- Abort in-flight fetch on unmount.
- Retry should re-run analysis for the same URL param.

### Success Rendering

- Keep four tabs with labels: `Agreed`, `Framing`, `Language`, `Unique`.
- If a section key is missing, render an empty string rather than crashing.
- Keep warning banner when `sources_fetched < sources_requested`.
- Share output should include all four full section headers or clear labels and section text.

## Alternatives Considered

- Pass story title and sources into results: useful polish, but not required for MVP and adds route-param complexity.
- Make `/digest` return a story id and analyze by id: deferred until server-side story cache exists.
- Remove warning banner because digest pre-validates stories: rejected because analysis can still fail later.

## Acceptance Criteria

- Existing successful analysis flow still works.
- Malformed `urls` params do not crash the screen.
- API 400/500/network errors show a user-readable message and Try again.
- Retry performs another `POST /analyze`.
- Partial-source warning still appears when appropriate.
- Share includes all four analysis sections.
- Results tests cover success, tab switching, error/retry, partial-source warning, share, and malformed params.

## Risks and Open Questions

- The screen currently assumes `data` is present after loading/error paths. Add defensive handling if tests expose a nullable crash path.
- The API secret behavior may differ between local and deployed environments. Keep existing header behavior unless deployment readiness spec changes it.

## Implementation Notes

Likely files:

- `app/app/(app)/results.tsx`
- `app/__tests__/results.test.tsx`

Verification:

```bash
cd app && npm test -- --runInBand
```
