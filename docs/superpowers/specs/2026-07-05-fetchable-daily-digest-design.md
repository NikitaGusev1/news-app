# Fetchable Daily Digest - Design Spec

**Date:** 2026-07-05  
**Status:** Approved

## What It Does

The mobile app opens to a daily digest of news headlines that are already ready for debiased analysis. A story appears in the digest only when the backend can fetch and extract article text from at least 2 sources covering the same story.

The first version optimizes for reliability over broad coverage. Users should be able to tap any visible headline and get the existing structured comparison without manually finding URLs or choosing sources.

## Product Promise

If a story appears in the digest, it should be analyzable.

This means the digest hides stories that look interesting but cannot produce at least 2 fetchable article bodies. The app should show fewer reliable stories instead of many headlines that may fail after the user taps them.

## Architecture

Backend flow:

1. Fetch RSS/feed items from a curated source list.
2. Group articles that appear to cover the same story.
3. Attempt to fetch and extract full article text for each article in a grouped story.
4. Keep only groups with at least 2 successfully extracted article bodies.
5. Return digest cards with display headline, source labels, and article URLs.

Mobile flow:

1. App opens to the daily digest.
2. User sees only headlines that are ready for analysis.
3. User taps a headline.
4. Results screen runs the existing debias analysis.
5. The first version has no URL paste, no source picking, and no Analyze button on the home screen.

## Components

### Backend

`backend/searcher.py`

- Keeps the curated RSS source list.
- Groups related articles into stories.
- Filters out stories unless at least 2 article bodies can be fetched.
- Exposes `get_digest()` for the API layer.

`fetcher.py`

- Remains the shared article extraction layer.
- Digest filtering should reuse `fetch_article()` or a thin wrapper around it so the digest and analysis agree on what "fetchable" means.

`backend/main.py`

- Adds `GET /digest`.
- Keeps the existing `POST /analyze` endpoint.

### Mobile App

`app/app/(app)/digest.tsx`

- Replaces the current search/select screen as the start screen.
- Shows pull-to-refresh daily headlines.
- Shows source badges for each story.
- Tapping a story navigates directly to results.

`app/app/(app)/results.tsx`

- Can mostly stay as-is for the first version.
- Receives story URLs from navigation params.
- Calls the existing `POST /analyze` endpoint.

## Data Flow

First version:

1. App opens.
2. `GET /digest` returns only fetchable story groups:

   ```json
   [
     {
       "title": "Example headline",
       "sources": ["NPR", "DW"],
       "urls": ["https://...", "https://..."]
     }
   ]
   ```

3. App renders those groups as headline rows.
4. User taps a headline.
5. App navigates to the results screen with the story URLs.
6. Results screen calls `POST /analyze`.
7. Backend fetches those URLs again and runs the existing analyzer.

This duplicates article fetching once, but keeps the first implementation simple and aligned with the current API. Server-side story caching is tracked in the root `BACKLOG.md`.

## Error Handling

| Scenario | Behavior |
|---|---|
| `/digest` fails | Show "Couldn't load digest" with Retry. |
| `/digest` returns no stories | Show "No ready stories right now" with pull-to-refresh. |
| Some feed items cannot be fetched | Hide those articles or stories from the digest. |
| A grouped story has fewer than 2 fetchable sources | Exclude it from the digest. |
| A tapped story later fails analysis | Use the existing results error state with Try again. |

## Testing

### Backend

- `/digest` returns only grouped stories with at least 2 fetchable article bodies.
- Stories with only 1 fetchable source are excluded.
- Feed/network failures do not break the whole digest.
- Digest results are capped to 5 stories.
- Existing `/analyze` behavior remains unchanged.

### Mobile

- Digest loads on app open.
- Story headlines and source badges render.
- Empty state appears when there are no ready stories.
- Retry appears when digest loading fails.
- Pull-to-refresh re-fetches the digest.
- Tapping a story navigates to results with the story URLs.

## Out of Scope

- Bypassing scraping blocks or paywalls.
- General "search any topic" coverage.
- Manual URL or text fallback in the first version.
- Server-side story caching in the first version.
- Expanding the curated source set before the fetchable digest loop is proven.
