---
date: 2026-07-11
author: Codex
status: approved
related_research:
  - docs/superpowers/specs/2026-07-05-fetchable-daily-digest-design.md
  - docs/superpowers/specs/2026-04-04-react-native-app-design.md
---

# Fetchable Digest MVP Product Contract

## Goal

Ship the smallest useful mobile MVP for News Debias: the app opens to a list of current news stories that the backend has already verified can produce an analysis, the user taps one story, and the existing results screen shows the four-section comparison.

The product promise is strict: if a story appears in the digest, at least two article bodies have already been fetch/extract validated by the backend using the same extraction path that analysis uses.

## Non-Goals

- No manual URL paste in MVP.
- No topic search in MVP.
- No source selection step or Analyze button on the home screen.
- No saved history, accounts, onboarding, push notifications, or paywall bypassing.
- No server-side story/article cache in MVP; duplicate fetching during analysis is acceptable.
- No expansion beyond the current curated source set until the fetchable digest loop is reliable.

## Current System

The repo currently has:

- `fetcher.py`: shared article extraction via `trafilatura`, with `fetch_article()` and `fetch_all()`.
- `analyzer.py`: prompt construction, Anthropic call, and response section parsing.
- `backend/main.py`: `POST /analyze` and `GET /search`; no `GET /digest` endpoint yet.
- `backend/searcher.py`: RSS source fetching, simple title grouping, `get_digest()`, and search over individual feed items.
- `app/app/(app)/url-input.tsx`: search/select flow.
- `app/app/(app)/results.tsx`: result fetch, tabbed four-section display, retry, warning banner, and share.
- `app/app/index.tsx`: redirects to `/(app)/url-input`.

The closest existing design is `docs/superpowers/specs/2026-07-05-fetchable-daily-digest-design.md`, but this MVP spec supersedes older search/manual-selection expectations for the first DAG implementation.

## Proposed Design

The MVP has one primary path:

1. App starts on a digest screen.
2. Digest screen calls `GET /digest`.
3. Backend fetches curated feeds, groups related stories, validates fetchability of each candidate article, and returns only story groups with at least two fetchable source URLs.
4. User taps a story.
5. App navigates to `/(app)/results` with the story URLs.
6. Results screen calls existing `POST /analyze`.
7. Backend re-fetches the URLs and runs the existing analyzer.
8. User sees the four existing analysis sections.

The MVP should feel reliable over broad. Empty digest is preferable to showing stories that fail after tap.

## Alternatives Considered

- Keep search/select in MVP: rejected because it exposes unreliable article URLs and adds selection complexity before proving the digest loop.
- Add manual URL paste fallback: rejected for MVP because it weakens the app’s first-run promise and creates a second input mode to test.
- Cache fetched article text during digest validation: deferred to backlog because current API can re-fetch during analysis with less architectural change.

## Acceptance Criteria

- App startup lands on digest, not URL/search input.
- Home screen contains no manual URL fields, no search bar, and no Analyze button.
- `GET /digest` returns story objects shaped as `{title, sources, urls}`.
- Every returned digest story has at least two URLs that passed article extraction validation.
- Tapping a digest story navigates to results with all story URLs.
- Results screen still displays the existing four analysis sections.
- All backend and app tests pass with updated expectations.

## Risks and Open Questions

- RSS title grouping is heuristic and may miss related stories or group loosely related ones. MVP accepts this if only validated multi-source stories are shown.
- Digest generation may be slow because it fetches article bodies. Use conservative caps and timeouts.
- A story can pass digest validation and fail later during analysis due to transient network or publisher changes. Results retry/error state remains necessary.

## Implementation Notes

This product contract should be implemented via separate specs:

- Backend fetchable digest API.
- Digest home app screen.
- Results MVP hardening.
- MVP verification/readiness.

Keep `.claude/ai/` as the artifact location so Claude and Codex DAG workflows share state.
