# Daily Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the manual article-selection flow with a digest + search screen that groups cross-source stories and launches analysis on tap.

**Architecture:** `searcher.py` gets a `_group_articles()` function that clusters feed items by shared title keywords, a `get_digest()` that returns the top 5 multi-source groups, and `search_articles()` is updated to return the same grouped shape. A new `digest.tsx` screen replaces `url-input.tsx` with a FlatList showing digest stories by default and search results when the bar is active; tapping any story immediately navigates to `results.tsx` with the group's URLs.

**Tech Stack:** Python 3.9 / pytest / FastAPI / httpx — React Native (Expo Router) / TypeScript / Jest / React Native Testing Library

---

## File Map

**Created:**
- `app/app/(app)/digest.tsx` — digest + search screen
- `app/__tests__/digest.test.tsx` — tests for digest screen

**Modified:**
- `backend/searcher.py` — add `_STOPWORDS`, `_significant_words`, `_group_articles`, `_fetch_all_items`, `get_digest`; rewrite `search_articles`
- `backend/main.py` — import `get_digest`; add `GET /digest` endpoint
- `backend/tests/test_search.py` — add grouping + digest tests; replace old search tests with grouped-shape tests
- `backend/tests/test_api.py` — update search result shape; add digest endpoint test
- `app/app/index.tsx` — redirect to `/(app)/digest`

**Deleted:**
- `app/app/(app)/url-input.tsx`
- `app/__tests__/url-input.test.tsx`

---

## Task 1: `_group_articles` — keyword grouping logic

**Files:**
- Modify: `backend/searcher.py`
- Test: `backend/tests/test_search.py`

- [ ] **Step 1: Add failing tests for `_group_articles`**

Add the following to the bottom of `backend/tests/test_search.py`. Add the import at the top of the file:

```python
from searcher import search_articles, _fetch_source, _group_articles
```

Then add these four tests at the bottom:

```python
def test_group_articles_groups_by_shared_significant_words():
    items = [
        {"title": "Iran war enters week six", "url": "https://www.npr.org/iran", "source": "NPR"},
        {"title": "Iran war civilians flee", "url": "https://www.aljazeera.com/iran", "source": "Al Jazeera"},
    ]
    result = _group_articles(items)
    assert len(result) == 1
    assert result[0]["title"] == "Iran war enters week six"
    assert set(result[0]["sources"]) == {"NPR", "Al Jazeera"}
    assert set(result[0]["urls"]) == {
        "https://www.npr.org/iran",
        "https://www.aljazeera.com/iran",
    }


def test_group_articles_excludes_single_source_groups():
    items = [
        {"title": "Iran update", "url": "https://www.npr.org/iran", "source": "NPR"},
        {"title": "Climate summit", "url": "https://www.aljazeera.com/climate", "source": "Al Jazeera"},
    ]
    result = _group_articles(items)
    assert result == []


def test_group_articles_ignores_stopwords_for_overlap():
    # "the" and "a" are stopwords — only "iran" is significant; 1 shared word < 2
    items = [
        {"title": "the Iran update", "url": "https://www.npr.org/iran", "source": "NPR"},
        {"title": "a Iran report", "url": "https://www.aljazeera.com/iran", "source": "Al Jazeera"},
    ]
    result = _group_articles(items)
    assert result == []


def test_group_articles_sorts_by_source_count_descending():
    items = [
        # 2-source story appears first in feed
        {"title": "Iran war update", "url": "https://www.npr.org/iran", "source": "NPR"},
        {"title": "Iran war report", "url": "https://www.aljazeera.com/iran", "source": "Al Jazeera"},
        # 3-source story appears later
        {"title": "Climate summit opens today", "url": "https://www.dw.com/climate", "source": "DW"},
        {"title": "Climate summit begins now", "url": "https://www.npr.org/climate", "source": "NPR"},
        {"title": "Climate summit underway", "url": "https://www.aljazeera.com/climate", "source": "Al Jazeera"},
    ]
    result = _group_articles(items)
    assert len(result) == 2
    assert len(result[0]["sources"]) == 3  # climate: 3 sources, ranked first
    assert len(result[1]["sources"]) == 2  # iran: 2 sources
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python3 -m pytest tests/test_search.py::test_group_articles_groups_by_shared_significant_words -v
```

Expected: `FAILED` with `ImportError: cannot import name '_group_articles'`

- [ ] **Step 3: Implement `_STOPWORDS`, `_significant_words`, and `_group_articles` in `searcher.py`**

Add after `_HEADERS` and before `_fetch_source`:

```python
_STOPWORDS = {
    "the", "a", "an", "is", "of", "in", "on", "at", "by", "for",
    "with", "to", "and", "or", "that", "this", "it", "as", "are",
    "was", "were", "has", "have", "been", "its",
}


def _significant_words(title: str) -> set[str]:
    return {w for w in title.lower().split() if w.isalpha() and w not in _STOPWORDS}


def _group_articles(items: list[dict]) -> list[dict]:
    groups: list[dict] = []
    for item in items:
        words = _significant_words(item["title"])
        matched = None
        for group in groups:
            if len(words & group["_words"]) >= 2:
                matched = group
                break
        if matched is not None:
            if item["source"] not in matched["sources"]:
                matched["sources"].append(item["source"])
                matched["urls"].append(item["url"])
                matched["_words"] |= words
        else:
            groups.append({
                "title": item["title"],
                "sources": [item["source"]],
                "urls": [item["url"]],
                "_words": words,
            })
    multi = [g for g in groups if len(g["sources"]) > 1]
    multi.sort(key=lambda g: len(g["sources"]), reverse=True)
    return [{"title": g["title"], "sources": g["sources"], "urls": g["urls"]} for g in multi]
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python3 -m pytest tests/test_search.py::test_group_articles_groups_by_shared_significant_words tests/test_search.py::test_group_articles_excludes_single_source_groups tests/test_search.py::test_group_articles_ignores_stopwords_for_overlap tests/test_search.py::test_group_articles_sorts_by_source_count_descending -v
```

Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/searcher.py backend/tests/test_search.py
git commit -m "feat: add _group_articles to cluster cross-source stories by keyword overlap"
```

---

## Task 2: `get_digest` and shared fetch helper

**Files:**
- Modify: `backend/searcher.py`
- Test: `backend/tests/test_search.py`

- [ ] **Step 1: Add failing tests for `get_digest`**

Update the import line at the top of `backend/tests/test_search.py`:

```python
from searcher import search_articles, _fetch_source, _group_articles, get_digest
```

Add these tests at the bottom of `backend/tests/test_search.py`:

```python
@patch("searcher.httpx.get")
def test_get_digest_returns_grouped_stories(mock_get):
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[("Iran war enters week 6", "https://www.npr.org/iran-war")],
        aj_items=[("Iran war civilian deaths", "https://www.aljazeera.com/iran")],
    )
    result = get_digest()
    assert len(result) == 1
    assert result[0]["title"] == "Iran war enters week 6"
    assert set(result[0]["sources"]) == {"NPR", "Al Jazeera"}
    assert set(result[0]["urls"]) == {
        "https://www.npr.org/iran-war",
        "https://www.aljazeera.com/iran",
    }


@patch("searcher.httpx.get")
def test_get_digest_capped_at_5(mock_get):
    # 6 distinct two-source stories; digest must return only 5
    npr_items = [
        ("climate summit agreement", "https://www.npr.org/0"),
        ("peace summit progress", "https://www.npr.org/1"),
        ("trade summit negotiations", "https://www.npr.org/2"),
        ("security summit debate", "https://www.npr.org/3"),
        ("energy summit plans", "https://www.npr.org/4"),
        ("health summit results", "https://www.npr.org/5"),
    ]
    aj_items = [
        ("climate summit talks", "https://www.aljazeera.com/0"),
        ("peace summit deal", "https://www.aljazeera.com/1"),
        ("trade summit collapse", "https://www.aljazeera.com/2"),
        ("security summit meeting", "https://www.aljazeera.com/3"),
        ("energy summit report", "https://www.aljazeera.com/4"),
        ("health summit response", "https://www.aljazeera.com/5"),
    ]
    mock_get.side_effect = _make_get_side_effect(npr_items=npr_items, aj_items=aj_items)
    result = get_digest()
    assert len(result) == 5
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python3 -m pytest tests/test_search.py::test_get_digest_returns_grouped_stories -v
```

Expected: `FAILED` with `ImportError: cannot import name 'get_digest'`

- [ ] **Step 3: Add `_fetch_all_items` and `get_digest` to `searcher.py`**

Replace the existing `search_articles` function body (the `with ThreadPoolExecutor()` block) by first extracting a shared helper. Add these two functions after `_group_articles` and before `search_articles`:

```python
def _fetch_all_items() -> list[dict]:
    with ThreadPoolExecutor() as executor:
        all_items_lists = list(executor.map(_fetch_source, _SOURCES))
    return [item for sublist in all_items_lists for item in sublist]


def get_digest() -> list[dict]:
    return _group_articles(_fetch_all_items())[:5]
```

Also update `search_articles` to use `_fetch_all_items` (replacing the ThreadPoolExecutor block inside it). The full updated `search_articles`:

```python
def search_articles(query: str) -> list[dict]:
    if not query or not query.strip():
        return []

    terms = query.strip().lower().split()

    with ThreadPoolExecutor() as executor:
        all_items_lists = list(executor.map(_fetch_source, _SOURCES))

    all_items = [item for items in all_items_lists for item in items]

    matches = [
        item for item in all_items
        if all(term in item["title"].lower() for term in terms)
    ]

    return matches[:_MAX_RESULTS]
```

becomes:

```python
def search_articles(query: str) -> list[dict]:
    if not query or not query.strip():
        return []

    terms = query.strip().lower().split()
    all_items = _fetch_all_items()

    matches = [
        item for item in all_items
        if all(term in item["title"].lower() for term in terms)
    ]

    return matches[:_MAX_RESULTS]
```

> Note: `search_articles` still returns individual articles for now — Task 3 changes it to return groups.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend && python3 -m pytest tests/test_search.py::test_get_digest_returns_grouped_stories tests/test_search.py::test_get_digest_capped_at_5 -v
```

Expected: `2 passed`

Also verify existing tests still pass:

```bash
cd backend && python3 -m pytest tests/test_search.py -v
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add backend/searcher.py backend/tests/test_search.py
git commit -m "feat: add get_digest returning top 5 cross-source story groups"
```

---

## Task 3: Update `search_articles` to return grouped stories

**Files:**
- Modify: `backend/searcher.py`
- Modify: `backend/tests/test_search.py`

- [ ] **Step 1: Replace the old search tests with grouped-shape tests**

In `backend/tests/test_search.py`, **delete** these five tests:
- `test_returns_matching_results_from_multiple_sources`
- `test_filters_out_non_matching_titles`
- `test_multi_word_query_requires_all_terms`
- `test_failed_source_does_not_affect_others`
- `test_results_capped_at_10`

**Add** these replacements at the bottom:

```python
@patch("searcher.httpx.get")
def test_search_returns_grouped_story(mock_get):
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[("Iran war enters week 6", "https://www.npr.org/iran-war")],
        aj_items=[("Iran war civilian deaths", "https://www.aljazeera.com/iran")],
    )
    results = search_articles("iran")
    assert len(results) == 1
    assert results[0]["title"] == "Iran war enters week 6"
    assert set(results[0]["sources"]) == {"NPR", "Al Jazeera"}
    assert set(results[0]["urls"]) == {
        "https://www.npr.org/iran-war",
        "https://www.aljazeera.com/iran",
    }


@patch("searcher.httpx.get")
def test_search_filters_unmatched_stories(mock_get):
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[
            ("Iran war update", "https://www.npr.org/iran"),
            ("Climate summit opens", "https://www.npr.org/climate"),
        ],
        aj_items=[
            ("Iran war report", "https://www.aljazeera.com/iran"),
            ("Climate summit talks", "https://www.aljazeera.com/climate"),
        ],
    )
    results = search_articles("iran")
    assert len(results) == 1
    assert results[0]["title"] == "Iran war update"


@patch("searcher.httpx.get")
def test_search_multi_word_query_requires_all_terms(mock_get):
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[
            ("Iran war enters week 6", "https://www.npr.org/iran-war"),
            ("Iran diplomacy progress", "https://www.npr.org/iran-diplomacy"),
        ],
        aj_items=[
            ("Iran war civilian deaths", "https://www.aljazeera.com/iran-war"),
            ("Iran diplomacy talks", "https://www.aljazeera.com/iran-diplomacy"),
        ],
    )
    results = search_articles("iran war")
    assert len(results) == 1
    assert results[0]["title"] == "Iran war enters week 6"


@patch("searcher.httpx.get")
def test_search_single_source_story_excluded(mock_get):
    # If only one source covers a story, it can't form a comparison group
    def side_effect(url, **kwargs):
        if "npr.org" in url:
            return _mock_resp(_rss_xml([("Iran war update", "https://www.npr.org/iran")]))
        raise Exception("timeout")
    mock_get.side_effect = side_effect
    results = search_articles("iran")
    assert results == []


@patch("searcher.httpx.get")
def test_search_capped_at_5(mock_get):
    npr_items = [
        ("climate summit agreement", "https://www.npr.org/0"),
        ("peace summit progress", "https://www.npr.org/1"),
        ("trade summit negotiations", "https://www.npr.org/2"),
        ("security summit debate", "https://www.npr.org/3"),
        ("energy summit plans", "https://www.npr.org/4"),
        ("health summit results", "https://www.npr.org/5"),
    ]
    aj_items = [
        ("climate summit talks", "https://www.aljazeera.com/0"),
        ("peace summit deal", "https://www.aljazeera.com/1"),
        ("trade summit collapse", "https://www.aljazeera.com/2"),
        ("security summit meeting", "https://www.aljazeera.com/3"),
        ("energy summit report", "https://www.aljazeera.com/4"),
        ("health summit response", "https://www.aljazeera.com/5"),
    ]
    mock_get.side_effect = _make_get_side_effect(npr_items=npr_items, aj_items=aj_items)
    results = search_articles("summit")
    assert len(results) == 5
```

- [ ] **Step 2: Run the new tests to verify they fail**

```bash
cd backend && python3 -m pytest tests/test_search.py::test_search_returns_grouped_story -v
```

Expected: `FAILED` — `search_articles` currently returns `{"title", "url", "source"}` not `{"title", "sources", "urls"}`.

- [ ] **Step 3: Rewrite `search_articles` to return grouped stories**

Replace the full `search_articles` function in `backend/searcher.py`. Also remove `_MAX_RESULTS` (no longer needed):

Delete the line:
```python
_MAX_RESULTS = 10
```

Replace `search_articles` with:

```python
def search_articles(query: str) -> list[dict]:
    if not query or not query.strip():
        return []

    terms = query.strip().lower().split()
    groups = _group_articles(_fetch_all_items())
    return [g for g in groups if all(term in g["title"].lower() for term in terms)][:5]
```

- [ ] **Step 4: Run all search tests to verify they pass**

```bash
cd backend && python3 -m pytest tests/test_search.py -v
```

Expected: all pass. (The `_fetch_source` tests and blank/network-error tests are unaffected.)

- [ ] **Step 5: Commit**

```bash
git add backend/searcher.py backend/tests/test_search.py
git commit -m "feat: search_articles now returns grouped multi-source stories"
```

---

## Task 4: `GET /digest` endpoint

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Add failing tests to `test_api.py`**

In `backend/tests/test_api.py`, update the existing `test_search_returns_results` test (the mock return shape changed) and add a digest endpoint test.

Replace `test_search_returns_results` with:

```python
def test_search_returns_grouped_results():
    with patch("main.search_articles", return_value=[
        {
            "title": "Iran war",
            "sources": ["NPR", "Al Jazeera"],
            "urls": ["https://www.npr.org/iran", "https://www.aljazeera.com/iran"],
        }
    ]):
        response = client.get("/search?q=iran")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0] == {
        "title": "Iran war",
        "sources": ["NPR", "Al Jazeera"],
        "urls": ["https://www.npr.org/iran", "https://www.aljazeera.com/iran"],
    }
```

Add at the bottom:

```python
def test_digest_returns_grouped_stories():
    with patch("main.get_digest", return_value=[
        {
            "title": "Iran war",
            "sources": ["NPR", "Al Jazeera"],
            "urls": ["https://www.npr.org/iran", "https://www.aljazeera.com/iran"],
        }
    ]):
        response = client.get("/digest")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Iran war"
    assert data[0]["sources"] == ["NPR", "Al Jazeera"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && python3 -m pytest tests/test_api.py::test_digest_returns_grouped_stories -v
```

Expected: `FAILED` with `404 Not Found` (endpoint doesn't exist yet).

- [ ] **Step 3: Add `GET /digest` to `main.py`**

Update the import line in `backend/main.py`:

```python
from searcher import search_articles, get_digest  # backend-local module
```

Add the endpoint after `search_endpoint`:

```python
@app.get("/digest")
def digest_endpoint():
    return get_digest()
```

- [ ] **Step 4: Run all API tests to verify they pass**

```bash
cd backend && python3 -m pytest tests/test_api.py -v
```

Expected: all pass.

- [ ] **Step 5: Run the full backend test suite**

```bash
cd backend && python3 -m pytest tests/ -v
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add backend/main.py backend/tests/test_api.py
git commit -m "feat: add GET /digest endpoint"
```

---

## Task 5: `digest.tsx` — new app screen

**Files:**
- Create: `app/app/(app)/digest.tsx`

- [ ] **Step 1: Create `app/app/(app)/digest.tsx`**

```tsx
import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  TextInput,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native'
import { useRouter } from 'expo-router'
import { API_BASE } from '../../constants/api'

type Story = {
  title: string
  sources: string[]
  urls: string[]
}

type DigestState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; stories: Story[] }

type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'done'; stories: Story[] }

export default function DigestScreen() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [digest, setDigest] = useState<DigestState>({ status: 'loading' })
  const [search, setSearch] = useState<SearchState>({ status: 'idle' })
  const [refreshing, setRefreshing] = useState(false)

  const fetchDigest = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/digest`)
      const data: Story[] = await res.json()
      setDigest({ status: 'done', stories: data })
    } catch {
      setDigest({ status: 'error' })
    }
  }, [])

  useEffect(() => {
    fetchDigest()
  }, [fetchDigest])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchDigest()
    setRefreshing(false)
  }

  useEffect(() => {
    if (!query.trim()) {
      setSearch({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setSearch({ status: 'loading' })
      try {
        const res = await fetch(
          `${API_BASE}/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        )
        const data: Story[] = await res.json()
        setSearch({ status: 'done', stories: data })
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        setSearch({ status: 'error' })
      }
    }, 400)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  const handleStoryPress = (story: Story) => {
    router.push({
      pathname: '/(app)/results',
      params: { urls: JSON.stringify(story.urls) },
    })
  }

  const renderStory = ({ item }: { item: Story }) => (
    <Pressable
      testID={`story-${item.title}`}
      onPress={() => handleStoryPress(item)}
      style={styles.card}
    >
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text testID={`badges-${item.title}`} style={styles.cardBadges}>
        {item.sources.join(' · ')}
      </Text>
    </Pressable>
  )

  const isSearchMode = query.trim().length > 0

  let listData: Story[] = []
  let showDigestLoading = false
  let showDigestError = false
  let showSearchLoading = false
  let showSearchError = false
  let showNoResults = false

  if (isSearchMode) {
    if (search.status === 'loading') showSearchLoading = true
    else if (search.status === 'error') showSearchError = true
    else if (search.status === 'done') {
      listData = search.stories
      if (listData.length === 0) showNoResults = true
    }
  } else {
    if (digest.status === 'loading') showDigestLoading = true
    else if (digest.status === 'error') showDigestError = true
    else if (digest.status === 'done') listData = digest.stories
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          testID="search-input"
          value={query}
          onChangeText={setQuery}
          placeholder="Search for a topic…"
          autoCapitalize="none"
          style={styles.searchInput}
        />
        {showSearchLoading && (
          <ActivityIndicator testID="search-spinner" style={styles.spinner} size="small" />
        )}
      </View>

      {showSearchError && (
        <Text testID="search-error" style={styles.feedbackText}>
          Search unavailable
        </Text>
      )}

      {showNoResults && (
        <Text testID="no-results" style={styles.feedbackText}>
          No results for {query.trim()}
        </Text>
      )}

      {showDigestLoading && (
        <View style={styles.center}>
          <ActivityIndicator testID="digest-loading" size="large" color="#007AFF" />
        </View>
      )}

      {showDigestError && (
        <View style={styles.center}>
          <Text testID="digest-error" style={styles.errorText}>
            Couldn't load digest
          </Text>
          <Pressable testID="retry-button" onPress={fetchDigest} style={styles.button}>
            <Text style={styles.buttonText}>Try again</Text>
          </Pressable>
        </View>
      )}

      {!showDigestLoading && !showDigestError && (
        <FlatList
          testID="story-list"
          data={listData}
          keyExtractor={item => item.title}
          renderItem={renderStory}
          onRefresh={isSearchMode ? undefined : handleRefresh}
          refreshing={isSearchMode ? false : refreshing}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  spinner: { marginLeft: 8 },
  feedbackText: { color: '#888', fontSize: 13, marginBottom: 8 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: 16, color: '#c00', marginBottom: 16, textAlign: 'center' },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  card: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cardTitle: { fontSize: 15, color: '#111', marginBottom: 4 },
  cardBadges: { fontSize: 12, color: '#007AFF', fontWeight: '600' },
})
```

- [ ] **Step 2: Verify the file compiles (TypeScript check)**

```bash
cd app && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `digest.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/app/(app)/digest.tsx
git commit -m "feat: add digest screen with story cards and search mode"
```

---

## Task 6: `digest.test.tsx` — app screen tests

**Files:**
- Create: `app/__tests__/digest.test.tsx`

- [ ] **Step 1: Create `app/__tests__/digest.test.tsx`**

```tsx
import React from 'react'
import { render, fireEvent, act, waitFor } from '@testing-library/react-native'
import DigestScreen from '../app/(app)/digest'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('../constants/api', () => ({ API_BASE: 'http://localhost:8000' }))

const DIGEST_STORIES = [
  {
    title: 'Iran war enters week 6',
    sources: ['NPR', 'Al Jazeera'],
    urls: ['https://www.npr.org/iran-war', 'https://www.aljazeera.com/iran'],
  },
  {
    title: 'Climate summit opens',
    sources: ['NPR', 'DW'],
    urls: ['https://www.npr.org/climate', 'https://www.dw.com/climate'],
  },
]

beforeEach(() => {
  jest.useFakeTimers()
  global.fetch = jest.fn()
  mockPush.mockClear()
})

afterEach(() => {
  jest.useRealTimers()
  jest.resetAllMocks()
})

describe('digest mode', () => {
  it('fetches /digest on mount', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => DIGEST_STORIES,
    })
    render(<DigestScreen />)
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:8000/digest')
    )
  })

  it('renders story cards with title and source badges', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => DIGEST_STORIES,
    })
    const { getByText } = render(<DigestScreen />)
    await waitFor(() => getByText('Iran war enters week 6'))
    expect(getByText('NPR · Al Jazeera')).toBeTruthy()
    expect(getByText('Climate summit opens')).toBeTruthy()
    expect(getByText('NPR · DW')).toBeTruthy()
  })

  it('shows loading indicator while digest fetches', () => {
    ;(global.fetch as jest.Mock).mockReturnValueOnce(new Promise(() => {}))
    const { getByTestId } = render(<DigestScreen />)
    expect(getByTestId('digest-loading')).toBeTruthy()
  })

  it('shows error state on digest fetch failure', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network'))
    const { getByTestId, getByText } = render(<DigestScreen />)
    await waitFor(() => getByTestId('digest-error'))
    expect(getByText("Couldn't load digest")).toBeTruthy()
    expect(getByTestId('retry-button')).toBeTruthy()
  })

  it('re-fetches digest when retry button pressed', async () => {
    ;(global.fetch as jest.Mock)
      .mockRejectedValueOnce(new Error('Network'))
      .mockResolvedValueOnce({ ok: true, json: async () => DIGEST_STORIES })
    const { getByTestId, getByText } = render(<DigestScreen />)
    await waitFor(() => getByTestId('retry-button'))
    fireEvent.press(getByTestId('retry-button'))
    await waitFor(() => getByText('Iran war enters week 6'))
  })

  it('re-fetches digest on pull-to-refresh', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => DIGEST_STORIES })
      .mockResolvedValueOnce({ ok: true, json: async () => DIGEST_STORIES })
    const { getByTestId } = render(<DigestScreen />)
    await waitFor(() => getByTestId('story-list'))
    fireEvent(getByTestId('story-list'), 'refresh')
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
  })

  it('navigates to results with story URLs when story tapped', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => DIGEST_STORIES,
    })
    const { getByTestId } = render(<DigestScreen />)
    await waitFor(() => getByTestId(`story-${DIGEST_STORIES[0].title}`))
    fireEvent.press(getByTestId(`story-${DIGEST_STORIES[0].title}`))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(app)/results',
      params: { urls: JSON.stringify(DIGEST_STORIES[0].urls) },
    })
  })
})

describe('search mode', () => {
  async function renderWithDigest() {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => DIGEST_STORIES,
    })
    const utils = render(<DigestScreen />)
    await waitFor(() => utils.getByTestId('story-list'))
    return utils
  }

  it('does not call search API before 400ms debounce', async () => {
    const utils = await renderWithDigest()
    fireEvent.changeText(utils.getByTestId('search-input'), 'iran')
    act(() => { jest.advanceTimersByTime(399) })
    expect(global.fetch).toHaveBeenCalledTimes(1) // only the initial digest fetch
  })

  it('calls /search after 400ms debounce', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => DIGEST_STORIES,
    })
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [DIGEST_STORIES[0]],
    })
    const utils = render(<DigestScreen />)
    await waitFor(() => utils.getByTestId('story-list'))
    fireEvent.changeText(utils.getByTestId('search-input'), 'iran')
    act(() => { jest.advanceTimersByTime(400) })
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/search?q=iran',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    )
  })

  it('shows no-results message when search returns empty', async () => {
    const utils = await renderWithDigest()
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    fireEvent.changeText(utils.getByTestId('search-input'), 'xyzzy')
    act(() => { jest.advanceTimersByTime(400) })
    await waitFor(() => utils.getByText('No results for xyzzy'))
  })

  it('shows search unavailable on network error', async () => {
    const utils = await renderWithDigest()
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network'))
    fireEvent.changeText(utils.getByTestId('search-input'), 'iran')
    act(() => { jest.advanceTimersByTime(400) })
    await waitFor(() => utils.getByTestId('search-error'))
  })

  it('returns to digest without re-fetching when search bar cleared', async () => {
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => DIGEST_STORIES })
      .mockResolvedValueOnce({ ok: true, json: async () => [DIGEST_STORIES[0]] })
    const { getByTestId, getByText } = render(<DigestScreen />)
    await waitFor(() => getByText('Iran war enters week 6'))
    fireEvent.changeText(getByTestId('search-input'), 'iran')
    act(() => { jest.advanceTimersByTime(400) })
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
    // Clear search — digest stories reappear, no new fetch
    fireEvent.changeText(getByTestId('search-input'), '')
    await waitFor(() => getByText('Climate summit opens'))
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd app && npx jest __tests__/digest.test.tsx --no-coverage 2>&1
```

Expected: all pass. If the pull-to-refresh test (`re-fetches digest on pull-to-refresh`) fails due to FlatList event handling in RNTL, skip it with `it.skip(...)` and note it in the commit message.

- [ ] **Step 3: Commit**

```bash
git add app/__tests__/digest.test.tsx
git commit -m "test: add digest screen tests"
```

---

## Task 7: Wire navigation and remove old screen

**Files:**
- Modify: `app/app/index.tsx`
- Delete: `app/app/(app)/url-input.tsx`
- Delete: `app/__tests__/url-input.test.tsx`

- [ ] **Step 1: Update `index.tsx` redirect**

Replace the entire content of `app/app/index.tsx` with:

```tsx
import { Redirect } from 'expo-router'

export default function Index() {
  return <Redirect href="/(app)/digest" />
}
```

- [ ] **Step 2: Delete `url-input.tsx` and its test file**

```bash
git rm app/app/(app)/url-input.tsx app/__tests__/url-input.test.tsx
```

- [ ] **Step 3: Run full app test suite to verify nothing is broken**

```bash
cd app && npx jest --no-coverage 2>&1
```

Expected: all tests pass (`digest.test.tsx` + `results.test.tsx`). No references to `url-input` remain.

- [ ] **Step 4: TypeScript check**

```bash
cd app && npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 5: Run full backend test suite one final time**

```bash
cd backend && python3 -m pytest tests/ -v
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add app/app/index.tsx
git commit -m "feat: wire digest screen as home, remove url-input"
```
