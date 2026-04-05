# Article Search — Design Spec

**Date:** 2026-04-05
**Status:** Approved

---

## What It Does

Adds a topic search feature to the URL input screen so users don't have to find article URLs manually. The user types a topic, gets a live list of matching articles from NPR, Al Jazeera, and DW, taps to select 2–3, then hits Analyze.

---

## Scope

- Fixed source set: NPR (`npr.org`), Al Jazeera (`aljazeera.com`), DW (`dw.com`)
- Free search via Google News RSS — no paid API
- Backend search endpoint + app UI redesign
- No new pip dependencies

---

## Backend

### New module: `backend/searcher.py`

Single public function:

```python
def search_articles(query: str) -> list[dict]:
    """
    Returns up to 10 results as:
    [{"title": "...", "url": "...", "source": "NPR"}, ...]
    """
```

**Implementation:**
1. Fetch Google News RSS:
   `https://news.google.com/rss/search?q={query}+site:npr.org+OR+site:aljazeera.com+OR+site:dw.com&hl=en-US&gl=US`
2. Parse XML with stdlib `xml.etree.ElementTree`
3. For each item, follow the Google redirect via a `HEAD` request to resolve the real article URL
4. Derive `source` label from the resolved URL domain (`npr.org` → `NPR`, `aljazeera.com` → `Al Jazeera`, `dw.com` → `DW`)
5. Return up to 10 results; silently skip any where redirect resolution fails

Returns an empty list if `query` is blank or no results are found. Does not raise on network errors — returns empty list with logged warning.

### New endpoint: `GET /search`

Added to `backend/main.py`:

```
GET /search?q={query}

Response 200:
[
  {"title": "Iran war enters week 6...", "url": "https://www.npr.org/...", "source": "NPR"},
  ...
]
```

Returns `[]` for blank query or no results. No 4xx for missing results.

---

## App

### URL Input Screen redesign (`app/app/(app)/url-input.tsx`)

**Removed:**
- Raw URL `TextInput` fields
- "+ Add source" button

**Initial state:** search bar + disabled Analyze button. No results list, no chips.

**New layout (top to bottom):**

1. **Search bar** — `TextInput` with placeholder "Search for a topic…". Debounced 400ms. Shows a small `ActivityIndicator` inside the bar while a request is in flight.

2. **Selected articles** — shown as horizontal-wrap removable chips between the search bar and results. Each chip: `[Source — Title  ×]`. Tapping × removes the article from selection. Hidden when nothing is selected.

3. **Results list** — rendered below selected chips when results are available. Each row: article title + source badge. Tapping a row adds it to selection (max 3). Already-selected rows are visually greyed out and non-tappable.

4. **Inline search feedback:**
   - No results → `"No results for [query]"` below the search bar
   - Search unavailable (network error) → `"Search unavailable"` below the search bar

5. **Analyze button** — same behaviour as today: disabled until ≥2 articles selected, navigates to results screen with selected URLs.

### Data flow

```
user types → debounce 400ms → GET /search?q= → results list
user taps result → added to selectedArticles (local state, max 3)
user taps × on chip → removed from selectedArticles
Analyze pressed → router.push with JSON.stringify(selectedArticles.map(a => a.url))
```

No global state. All selection state is local `useState` in `url-input.tsx`.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Blank query | Skip API call, clear results |
| No results | "No results for [query]" inline |
| Network error on `/search` | "Search unavailable" inline; does not block analyzing |
| Google redirect fails for a result | Silently skip that result |
| Fewer than 2 articles selected | Analyze button disabled |

---

## Testing

### Backend — `backend/tests/test_search.py` (new)

- `search_articles()` returns correctly shaped results from mocked XML response
- Redirect resolution maps Google URL → real article URL
- Results capped at 10
- Returns `[]` for blank query
- Returns `[]` and does not raise on network error
- Silently skips results where redirect resolution fails

### App — `app/__tests__/url-input.test.tsx` (extended)

- Search API not called before debounce fires (< 400ms)
- Search API called after 400ms
- Results render with title and source label
- Tapping a result adds it to selected chips
- Already-selected result is greyed out and non-tappable
- Tapping × on a chip removes it
- Analyze button disabled with 1 selected, enabled with 2
- "No results" message shown when API returns `[]`
- "Search unavailable" message shown on network error

---

## Out of Scope

- Manual URL paste (removed; can be revisited)
- Expanding the source set beyond NPR / Al Jazeera / DW
- Paid search API
- Caching search results
- Search history / recent searches
