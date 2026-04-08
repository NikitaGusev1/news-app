# Code Quality Improvements — Design Spec

**Date:** 2026-04-08
**Status:** Approved

---

## What It Does

Seven targeted cleanup items across the backend and frontend, grouped into one implementation pass: a feed cache, a search pre-filter, internal grouping cleanup, shared TypeScript state types, simplified refresh state, shared style constants, and a typed navigation helper.

---

## Scope

**Backend (`backend/searcher.py`):**
- Module-level TTL cache on `_fetch_all_items`
- Pre-filter articles by query terms before grouping in `search_articles`
- Remove `_words` key from group dicts by tracking words in a parallel list

**Frontend:**
- `constants/styles.ts` — shared style rules extracted from `digest.tsx` and `results.tsx`
- `constants/routes.ts` — route constant + `navigateToResults` helper
- `app/app/(app)/digest.tsx` — import shared styles/routes, refactor DigestState, remove `refreshing` boolean

No new dependencies. No API shape changes.

---

## Backend

### 1. Feed cache in `_fetch_all_items`

Add a module-level cache variable:

```python
_cache: tuple[float, list[dict]] | None = None
```

`_fetch_all_items` checks the cache on every call:

```python
def _fetch_all_items() -> list[dict]:
    global _cache
    if _cache is not None and time.time() - _cache[0] < 600:
        return _cache[1]
    with ThreadPoolExecutor() as executor:
        all_items_lists = list(executor.map(_fetch_source, _SOURCES))
    result = [item for sublist in all_items_lists for item in sublist]
    _cache = (time.time(), result)
    return result
```

TTL is 600 seconds (10 minutes). Both `get_digest` and `search_articles` benefit automatically. The `time` module is already in stdlib — no new dependency.

Cache is intentionally not invalidated on error: if all sources fail, the previous cached result continues to be served rather than returning empty. This is the correct behaviour for a read-only feed.

### 2. Pre-filter before grouping in `search_articles`

Current flow: fetch all → group all → filter groups by title.

New flow: fetch all → filter articles by query terms → group filtered articles.

```python
def search_articles(query: str) -> list[dict]:
    if not query or not query.strip():
        return []

    terms = query.strip().lower().split()
    items = [
        item for item in _fetch_all_items()
        if all(term in item["title"].lower() for term in terms)
    ]
    return _group_articles(items)[:_DIGEST_SIZE]
```

A group now only forms if multiple sources each published an article whose title contains all query terms. This is semantically correct (each member article is about the topic, not just the canonical title) and reduces grouping work proportionally to query specificity.

Test impact: existing `test_search_*` tests use mocked feeds with titles that already satisfy this — no test changes needed.

### 3. Remove `_words` from group dicts

Current: group dicts carry a `_words: set[str]` key during grouping, stripped only in the final list comprehension.

New: track words in a parallel `list[set[str]]`, indexed alongside `groups`. The group dict never contains `_words`.

```python
def _group_articles(items: list[dict]) -> list[dict]:
    groups: list[dict] = []
    group_words: list[set[str]] = []
    for item in items:
        words = _significant_words(item["title"])
        matched_idx = next(
            (i for i, gw in enumerate(group_words) if len(words & gw) >= 2),
            None,
        )
        if matched_idx is not None:
            g = groups[matched_idx]
            if item["source"] not in g["sources"]:
                g["sources"].append(item["source"])
                g["urls"].append(item["url"])
                group_words[matched_idx] |= words
        else:
            groups.append({
                "title": item["title"],
                "sources": [item["source"]],
                "urls": [item["url"]],
            })
            group_words.append(words)
    multi = [(g, gw) for g, gw in zip(groups, group_words) if len(g["sources"]) > 1]
    multi.sort(key=lambda pair: len(pair[0]["sources"]), reverse=True)
    return [g for g, _ in multi]
```

No behaviour change. Group dicts are now clean output structures from the moment of creation.

---

## Frontend

### 4. `constants/styles.ts`

New file. Exports shared style rules used identically in `digest.tsx` and `results.tsx`:

```ts
import { StyleSheet } from 'react-native'

export const sharedStyles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { fontSize: 16, color: '#c00', marginBottom: 16, textAlign: 'center' },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

`center` includes `padding: 20` (matching `results.tsx`; `digest.tsx` previously omitted it).

Both screens remove their local copies of these four rules and import `sharedStyles` instead.

### 5. `constants/routes.ts`

New file. Exports the results route path and a typed navigation helper:

```ts
import { useRouter } from 'expo-router'

export const ROUTES = {
  results: '/(app)/results' as const,
}

export function navigateToResults(
  router: ReturnType<typeof useRouter>,
  urls: string[]
): void {
  router.push({
    pathname: ROUTES.results,
    params: { urls: JSON.stringify(urls) },
  })
}
```

`digest.tsx` replaces the `handleStoryPress` body with `navigateToResults(router, story.urls)`.

`results.tsx` is unchanged — it continues to receive the param via `useLocalSearchParams` and decode with `JSON.parse`. The encoding/decoding contract is now explicit and in one place.

### 6. DigestState refactor + refreshing state

**New types:**

```ts
type LoadingState = { status: 'loading' }
type ErrorState = { status: 'error' }

type DigestState =
  | LoadingState
  | ErrorState
  | { status: 'refreshing'; stories: Story[] }
  | { status: 'done'; stories: Story[] }

type SearchState =
  | { status: 'idle' }
  | LoadingState
  | ErrorState
  | { status: 'done'; stories: Story[] }
```

**`refreshing` boolean removed.** `fetchDigest` gains an optional `refresh` parameter. It uses `setDigest`'s functional form to read current state without capturing `digest` as a dependency — keeping `fetchDigest` stable (empty dep array) so the mount `useEffect` doesn't re-fire on every state change:

```ts
const fetchDigest = useCallback(async (opts?: { refresh?: boolean }) => {
  if (opts?.refresh) {
    setDigest(prev =>
      prev.status === 'done'
        ? { status: 'refreshing', stories: prev.stories }
        : prev
    )
  }
  try {
    const res = await fetch(`${API_BASE}/digest`)
    const data: Story[] = await res.json()
    setDigest({ status: 'done', stories: data })
  } catch {
    setDigest({ status: 'error' })
  }
}, [])
```

`handleRefresh` is removed. The FlatList uses:

```tsx
onRefresh={() => fetchDigest({ refresh: true })}
refreshing={digest.status === 'refreshing'}
```

The mode logic updates:

```ts
const showDigestLoading = !isSearchMode && digest.status === 'loading'
const showDigestError = !isSearchMode && digest.status === 'error'
// listData from digest:
if (digest.status === 'done' || digest.status === 'refreshing') listData = digest.stories
```

---

## Testing

### Backend — `test_search.py`

- `_fetch_all_items` returns cached result within TTL
- `_fetch_all_items` re-fetches after TTL expires
- `search_articles` only passes matching articles to `_group_articles` (pre-filter verified via a test where one source has an article matching the query and another does not — only the matching articles should form a group)
- `_group_articles` group dicts contain no `_words` key

### Frontend — `digest.test.tsx`

- Existing tests for digest and search modes pass unchanged (`.stories` property name unchanged)
- `digest.status === 'refreshing'` shown during pull-to-refresh (FlatList `refreshing` prop is true)
- Stories remain visible during refresh (list not empty while refreshing)
- On refresh error, digest status becomes `error`

### No new tests needed for `constants/styles.ts` or `constants/routes.ts` (pure data/helpers, covered by existing screen tests).

---

## Out of Scope

- Cache invalidation on demand (not needed for a read-only feed consumer)
- Shared `AsyncState<T>` generic with `.data` rename (breaks test references, no benefit over shared base types)
- Pre-filtering `get_digest` (digest always shows the full cross-source picture; filtering is search-only)
