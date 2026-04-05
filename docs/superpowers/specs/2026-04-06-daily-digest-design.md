# Daily Digest — Design Spec

**Date:** 2026-04-06
**Status:** Approved

---

## What It Does

Replaces the manual article-selection flow with a story-first experience. The app opens to a digest of today's top 5 cross-source stories (ranked by how many of the 3 sources cover them). Tapping a story immediately runs the Claude analysis. A search bar on the same screen filters stories by topic using the same grouping logic.

---

## Scope

- New `GET /digest` endpoint + story grouping logic in `searcher.py`
- `GET /search` updated to return grouped stories instead of individual articles
- `url-input.tsx` replaced by `digest.tsx`
- `results.tsx` unchanged
- No new dependencies

---

## Backend

### Story grouping: `_group_articles(items: list[dict]) -> list[dict]`

New private function in `searcher.py`. Takes all articles fetched from all sources, groups them by significant title word overlap:

1. Strip stopwords from each title (the, a, an, is, of, in, on, at, by, for, with, to, and, or, that, this, it, as, are, was, were, has, have, been, its) and lowercase
2. Two articles are in the same group if they share ≥2 significant words
3. Greedy left-to-right assignment: for each article, find the first existing group with a member sharing ≥2 significant words; if none, create a new group
4. Discard groups with only 1 source (can't produce a meaningful comparison)
5. Sort groups: by source count descending, then by feed position within each tier (feeds are newest-first, so position proxies recency)

Each group:
```json
{"title": "Iran war enters week 6", "sources": ["NPR", "Al Jazeera"], "urls": ["...", "..."]}
```

`title` is taken from the first article in the group (NPR order, since NPR is first in `_SOURCES`).

### `get_digest() -> list[dict]`

New public function in `searcher.py`:
1. Fetch all 3 feeds in parallel (reusing `_fetch_source` + `ThreadPoolExecutor`)
2. Flatten results
3. Call `_group_articles()`
4. Return top 5 groups

### `search_articles(query: str) -> list[dict]`

Updated: same fetch + group pipeline as `get_digest()`, but after grouping, filters to groups whose title contains all query terms (case-insensitive). Returns up to 5.

### New endpoint

```
GET /digest

Response 200:
[
  {"title": "Iran war enters week 6", "sources": ["NPR", "Al Jazeera", "DW"], "urls": ["...", "...", "..."]},
  ...  // up to 5
]
```

`GET /search?q=` returns the same shape (previously returned individual articles).

---

## App

### Navigation

`index.tsx` redirect updated from `/(app)/url-input` → `/(app)/digest`.

### New screen: `digest.tsx` (replaces `url-input.tsx`)

Single screen with two modes, controlled by the search bar state.

**Layout (top to bottom):**
1. Search bar — `TextInput` with placeholder "Search for a topic…", debounced 400ms
2. Story list — `FlatList` with `onRefresh` / `refreshing` for pull-to-refresh

**Default mode (no query):** fetches `GET /digest` on mount and on pull-to-refresh. Shows up to 5 story cards.

**Search mode (query active):** fetches `GET /search?q=` debounced. Results replace the digest list. Clearing the bar returns to the already-loaded digest (no re-fetch; use pull-to-refresh to update).

**Story card:** title + row of source badges (e.g. `NPR · Al Jazeera · DW`).

**Tapping a story:**
```ts
router.push({ pathname: '/(app)/results', params: { urls: JSON.stringify(story.urls) } })
```
No selection step, no Analyze button.

**States:**

| State | Behaviour |
|---|---|
| Loading digest | `ActivityIndicator` centered |
| Digest error | "Couldn't load digest" + retry button |
| Search loading | `ActivityIndicator` inside search bar |
| Search error | "Search unavailable" below bar |
| No search results | "No results for [query]" below bar |

### `results.tsx`

Unchanged. Already receives `urls` via params and calls `POST /analyze`.

---

## Data Flow

```
App open → GET /digest → story cards
Pull-to-refresh → GET /digest → story cards
User types → debounce 400ms → GET /search?q= → filtered story cards
User taps story → router.push('/(app)/results', { urls: story.urls })
Results screen → POST /analyze → existing analysis display
```

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Digest fetch fails | "Couldn't load digest" + retry button |
| Search fetch fails | "Search unavailable" inline below bar |
| No search results | "No results for [query]" inline |
| Story covered by only 1 source | Excluded from grouping (silently) |
| `/analyze` fails | Unchanged — existing error + "Try again" on results screen |

---

## Testing

### Backend — `test_search.py` (extended)

- `_group_articles()` groups articles sharing ≥2 significant words
- `_group_articles()` excludes single-source groups
- `_group_articles()` sorts by source count descending
- `get_digest()` returns up to 5 groups
- `search_articles()` returns grouped stories filtered by query
- `search_articles()` returns `[]` for blank query (unchanged)
- `search_articles()` returns `[]` on network error (unchanged)

### App — `app/__tests__/digest.test.tsx` (new)

- Digest fetched on mount, story cards rendered with title and source badges
- Pull-to-refresh re-fetches digest
- Typing in search bar calls `GET /search` after 400ms debounce
- Clearing search bar returns to digest view
- Tapping a story navigates to results with correct URLs
- Loading state shown while digest fetches
- Error state shown on digest fetch failure
- "No results" shown when search returns empty

---

## Out of Scope

- Caching digest between sessions
- Push notifications for breaking stories
- Expanding source set beyond NPR / Al Jazeera / DW
- Story deduplication across days
- Manual URL entry (already removed)
