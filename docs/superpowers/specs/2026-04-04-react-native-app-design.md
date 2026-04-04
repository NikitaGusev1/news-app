# News Debias — React Native App Design Spec

**Date:** 2026-04-04
**Status:** Approved

---

## What It Does

A React Native (Expo) mobile app that wraps the existing news-debias analysis tool. The user pastes 2–3 article URLs, the app calls a local FastAPI backend, and displays a structured 4-section bias comparison in a tabbed results screen.

---

## Repo Structure

Monorepo — single GitHub repo, two packages:

```
news-app/
  backend/
    main.py          # FastAPI app, single /analyze endpoint
    fetcher.py       # Moved from root (unchanged)
    analyzer.py      # Prompt construction, Claude API call, section parsing
    requirements.txt
    tests/
      test_analyzer.py
      test_api.py
  app/
    app/
      index.tsx              # 3-line redirect to /(app)/url-input
      (app)/
        url-input.tsx        # URL input screen
        results.tsx          # Analysis results screen
    constants/
      api.ts                 # API_BASE = 'http://localhost:8000'
    __tests__/
      url-input.test.tsx
      results.test.tsx
    package.json
    app.json
  README.md
```

---

## Backend

### API Endpoint

```
POST /analyze
Content-Type: application/json

Body:
{
  "urls": ["https://...", "https://..."]   // 2–5 URLs
}

Response 200:
{
  "sections": {
    "WHAT ALL SOURCES AGREE ON": "...",
    "HOW EACH SOURCE FRAMED IT": "...",
    "LANGUAGE WORTH NOTICING": "...",
    "FACTS ONLY ONE SOURCE REPORTED": "..."
  },
  "meta": {
    "sources_fetched": 2,
    "sources_requested": 2,
    "tokens_used": 6241
  }
}

Response 400:
{ "detail": "Need at least 2 sources to compare, only got N." }

Response 422: FastAPI default (malformed request body)
Response 500: Unhandled exceptions
```

### `analyzer.py`

Extracted from `news_debias.py`. Exposes:

```python
def analyze(articles: list[tuple[str, str]]) -> dict:
    """
    Takes list of (domain_label, article_text) tuples.
    Returns { "sections": {...}, "tokens_used": N }.
    """
```

`main.py` orchestrates: validate input → call `fetch_all()` → call `analyze()` → return response.

### Running locally

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Requires `ANTHROPIC_API_KEY` in environment.

---

## App

### Navigation

Expo Router, file-based. Two real screens:

- `app/(app)/url-input.tsx` — entry point (redirected from `app/index.tsx`)
- `app/(app)/results.tsx` — analysis results

### URL Input Screen (`url-input.tsx`)

- 2 `TextInput` fields for URLs, rendered by default
- "+ Add source" button reveals a third field (max 3)
- "Analyze" button — disabled until ≥2 fields have non-empty values
- On submit: `router.push({ pathname: '/(app)/results', params: { urls: JSON.stringify(urls) } })`
- No client-side URL format validation — backend handles fetch failures

### Results Screen (`results.tsx`)

- Parses URLs from `useLocalSearchParams()`
- Calls `POST /analyze` in `useEffect` on mount
- Local state: `loading | data | error`

**Loading state:** `ActivityIndicator` centered on screen

**Error state:** Error message + "Try again" button that re-triggers the fetch

**Success state:**
- Header: domain labels of sources analysed (from `meta.sources_fetched`)
- Warning banner if `meta.sources_fetched < meta.sources_requested`: "Only N of M sources could be fetched"
- Scrollable tabs — 4 tabs with short labels:
  - *Agreed* → `WHAT ALL SOURCES AGREE ON`
  - *Framing* → `HOW EACH SOURCE FRAMED IT`
  - *Language* → `LANGUAGE WORTH NOTICING`
  - *Unique* → `FACTS ONLY ONE SOURCE REPORTED`
- Each tab: plain scrollable text content
- Share button (header top-right): concatenates all 4 sections into plain text, calls `Share.share({ message })`

### Constants

```ts
// constants/api.ts
export const API_BASE = 'http://localhost:8000'
```

### State Management

No global state. Linear flow:
- URLs passed via Expo Router search params
- Results fetched and held in local `useState` on the results screen
- No React Query / SWR

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Loading | `ActivityIndicator` centered |
| Network error / 500 | Error message + "Try again" button |
| 400 (< 2 sources fetched) | Error message + "Try again" button |
| Some URLs skipped (fetched < requested) | Warning banner above tabs, show results |
| Fewer than 2 URLs entered | "Analyze" button disabled |

---

## Testing

### Backend (pytest)

- `tests/test_analyzer.py` — unit tests for `analyze()` with mocked Anthropic client; covers prompt construction and section parsing
- `tests/test_api.py` — FastAPI route tests with mocked `fetch_all` and `analyze`; covers 200, 400, 500 responses

### App (Jest + React Native Testing Library)

- `__tests__/url-input.test.tsx` — button disabled with <2 URLs, enabled with 2, "+ Add source" reveals third field
- `__tests__/results.test.tsx` — loading state, success state with fixture data, error state, warning banner when sources_fetched < sources_requested

---

## Out of Scope (MVP)

- User accounts / auth
- Saved analysis history
- Streaming Claude responses
- Share sheet extension (share from browser)
- More than 3 URLs in the app (backend still supports 5)
- Remote deployment
- Dark mode
- Onboarding / tutorial screens
