---
date: 2026-07-11
author: Codex
status: approved
related_research:
  - .claude/ai/spec-2026-07-11-mvp-product-contract.md
  - .claude/ai/spec-2026-07-11-fetchable-digest-backend.md
---

# Digest Home App Screen

## Goal

Replace the current search/select home screen with a fetchable digest home screen. The user should open the app, see ready-to-analyze stories, tap one, and go straight to results.

## Non-Goals

- No manual URL input in MVP.
- No search bar in MVP.
- No selected article chips.
- No Analyze button on the home screen.
- No saved digest cache between app launches.
- No visual redesign beyond a clean functional MVP screen.

## Current System

The app currently uses Expo Router:

- `app/app/index.tsx` redirects to `/(app)/url-input`.
- `app/app/(app)/url-input.tsx` implements topic search, result rows, selected chips, and an Analyze button.
- `app/app/(app)/results.tsx` accepts `urls` route params and calls `POST /analyze`.
- `app/constants/api.ts` defines `API_BASE`.
- `app/__tests__/url-input.test.tsx` tests the current search/select flow.

## Proposed Design

Create a new screen at `app/app/(app)/digest.tsx` and make it the start route.

### Navigation

Update `app/app/index.tsx`:

```tsx
return <Redirect href="/(app)/digest" />
```

When the user taps a story:

```ts
router.push({
  pathname: '/(app)/results',
  params: { urls: JSON.stringify(story.urls) },
})
```

### Types

```ts
type DigestStory = {
  title: string
  sources: string[]
  urls: string[]
}
```

### Screen Behavior

On mount:

- call `GET ${API_BASE}/digest`;
- show centered loading while the first request is in flight;
- render story rows/cards when data arrives;
- show empty state when response is `[]`;
- show retry state when the request fails.

Pull-to-refresh:

- refresh the digest by calling `/digest` again;
- preserve the same empty/error behavior after refresh.

Story row/card:

- displays title;
- displays source badges or compact source text;
- entire row is pressable;
- tapping row navigates to results.

### UI States

- Loading: `ActivityIndicator` centered.
- Error: `Couldn't load digest` plus Retry button.
- Empty: `No ready stories right now` plus pull-to-refresh support.
- Success: vertical list of stories.
- Refreshing: use `FlatList` `refreshing` / `onRefresh`.

## Alternatives Considered

- Reuse `url-input.tsx` and mutate it into digest: possible, but a new `digest.tsx` makes MVP route intent clearer and lets old search tests be replaced cleanly.
- Keep search as a secondary mode: rejected for MVP because fetchable digest only is the product promise.
- Add a manual fallback button: rejected for MVP.

## Acceptance Criteria

- App index redirects to `/(app)/digest`.
- Digest screen calls `/digest` on mount.
- Digest stories render with title and sources.
- Empty state renders for `[]`.
- Error state renders with Retry.
- Pull-to-refresh re-fetches digest.
- Tapping a story navigates to results with `JSON.stringify(story.urls)`.
- No manual URL fields, search input, selected chips, or Analyze button remain on the MVP home screen.
- App tests cover loading, success, empty, error/retry, refresh, and navigation.

## Risks and Open Questions

- Current tests are tied to `url-input.tsx`; they should be replaced or moved to `digest.test.tsx` rather than kept failing.
- Current API base points at a Railway deployment. MVP testing may need mock API base in Jest and documented local override for development.

## Implementation Notes

Likely files:

- `app/app/index.tsx`
- `app/app/(app)/digest.tsx`
- `app/__tests__/digest.test.tsx`
- `app/__tests__/url-input.test.tsx` should be removed or rewritten if `url-input.tsx` is removed from the active MVP.

Verification:

```bash
cd app && npm test -- --runInBand
```

If the repo has no lint/typecheck script, do not invent one; note the skip in implementation summary.
