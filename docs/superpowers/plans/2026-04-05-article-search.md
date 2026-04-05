# Article Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a topic search bar to the URL input screen so users can find articles from NPR, Al Jazeera, and DW without hunting for URLs manually.

**Architecture:** A new `backend/searcher.py` queries Google News RSS with `site:` filters, follows Google redirect URLs to real article URLs via HEAD request, and returns labelled results. A new `GET /search?q=` endpoint exposes this. The `url-input.tsx` screen is rewritten: URL TextInputs are replaced with a debounced search bar, removable selection chips, and a tappable results list.

**Tech Stack:** Python `xml.etree.ElementTree` (stdlib) + `httpx` (already installed); React Native `useEffect` debounce (no new deps on either side)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/searcher.py` | Create | `search_articles(query)` — RSS fetch, XML parse, redirect resolution, source labelling |
| `backend/tests/test_search.py` | Create | Unit tests for `search_articles` |
| `backend/main.py` | Modify | Add `GET /search?q=` endpoint + update CORS to allow GET |
| `backend/tests/test_api.py` | Modify | Add tests for `GET /search` |
| `app/app/(app)/url-input.tsx` | Modify | Replace URL inputs with search bar + chips + results list |
| `app/__tests__/url-input.test.tsx` | Modify | Replace old tests with search UI tests |

---

### Task 1: `backend/searcher.py` — core implementation

**Files:**
- Create: `backend/searcher.py`
- Create: `backend/tests/test_search.py`

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_search.py`:

```python
import pytest
from unittest.mock import patch, MagicMock

from searcher import search_articles


def make_rss_xml(items):
    """Build a minimal Google News RSS XML string.
    items: list of (title, google_link) tuples.
    """
    item_xml = "".join(
        f"<item><title>{title}</title><link>{link}</link></item>"
        for title, link in items
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<rss version=\"2.0\"><channel>" + item_xml + "</channel></rss>"
    )


def mock_get_ok(xml_text):
    m = MagicMock()
    m.text = xml_text
    return m


def mock_head_ok(real_url: str):
    m = MagicMock()
    m.url = real_url
    m.status_code = 200
    return m


@patch("searcher.httpx.head")
@patch("searcher.httpx.get")
def test_returns_shaped_results(mock_get, mock_head):
    xml = make_rss_xml([
        ("Iran war enters week 6 - NPR", "https://news.google.com/rss/articles/abc"),
        ("Iran: civilians at risk - Al Jazeera", "https://news.google.com/rss/articles/def"),
    ])
    mock_get.return_value = mock_get_ok(xml)
    mock_head.side_effect = [
        mock_head_ok("https://www.npr.org/2026/04/04/nx-s1-5773436/iran-war"),
        mock_head_ok("https://www.aljazeera.com/news/2026/4/4/iran-civilians"),
    ]

    results = search_articles("iran")

    assert len(results) == 2
    assert results[0] == {
        "title": "Iran war enters week 6",
        "url": "https://www.npr.org/2026/04/04/nx-s1-5773436/iran-war",
        "source": "NPR",
    }
    assert results[1] == {
        "title": "Iran: civilians at risk",
        "url": "https://www.aljazeera.com/news/2026/4/4/iran-civilians",
        "source": "Al Jazeera",
    }


@patch("searcher.httpx.head")
@patch("searcher.httpx.get")
def test_dw_source_label(mock_get, mock_head):
    xml = make_rss_xml([
        ("Ukraine update - DW", "https://news.google.com/rss/articles/ghi"),
    ])
    mock_get.return_value = mock_get_ok(xml)
    mock_head.return_value = mock_head_ok("https://www.dw.com/en/ukraine/a-12345")

    results = search_articles("ukraine")

    assert results[0]["source"] == "DW"
    assert results[0]["url"] == "https://www.dw.com/en/ukraine/a-12345"


def test_blank_query_returns_empty_without_http():
    with patch("searcher.httpx.get") as mock_get, \
         patch("searcher.httpx.head") as mock_head:
        assert search_articles("") == []
        assert search_articles("   ") == []
        mock_get.assert_not_called()
        mock_head.assert_not_called()


@patch("searcher.httpx.get")
def test_network_error_returns_empty(mock_get):
    mock_get.side_effect = Exception("connection refused")
    assert search_articles("iran") == []


@patch("searcher.httpx.head")
@patch("searcher.httpx.get")
def test_results_capped_at_10(mock_get, mock_head):
    items = [
        (f"Article {i} - NPR", f"https://news.google.com/rss/articles/{i}")
        for i in range(15)
    ]
    mock_get.return_value = mock_get_ok(make_rss_xml(items))
    mock_head.side_effect = [
        mock_head_ok(f"https://www.npr.org/article-{i}") for i in range(15)
    ]

    results = search_articles("news")
    assert len(results) == 10


@patch("searcher.httpx.head")
@patch("searcher.httpx.get")
def test_skips_failed_redirects(mock_get, mock_head):
    xml = make_rss_xml([
        ("Article A - NPR", "https://news.google.com/rss/articles/good"),
        ("Article B - NPR", "https://news.google.com/rss/articles/bad"),
    ])
    mock_get.return_value = mock_get_ok(xml)
    mock_head.side_effect = [
        mock_head_ok("https://www.npr.org/article-a"),
        Exception("timeout"),
    ]

    results = search_articles("test")
    assert len(results) == 1
    assert results[0]["title"] == "Article A"
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && python3 -m pytest tests/test_search.py -v 2>&1 | head -20
```

Expected: `ModuleNotFoundError: No module named 'searcher'`

- [ ] **Step 3: Create `backend/searcher.py`**

```python
import urllib.parse
import xml.etree.ElementTree as ET
import httpx

_RSS_URL = (
    "https://news.google.com/rss/search"
    "?q={query}+site:npr.org+OR+site:aljazeera.com+OR+site:dw.com"
    "&hl=en-US&gl=US"
)

_SOURCE_MAP = {
    "npr.org": "NPR",
    "aljazeera.com": "Al Jazeera",
    "dw.com": "DW",
}

_MAX_RESULTS = 10


def _resolve_redirect(google_url: str) -> str | None:
    try:
        resp = httpx.head(google_url, follow_redirects=True, timeout=5)
        return str(resp.url)
    except Exception:
        return None


def _source_label(url: str) -> str | None:
    for domain, label in _SOURCE_MAP.items():
        if domain in url:
            return label
    return None


def _clean_title(title: str) -> str:
    """Strip ' - Source Name' suffix that Google News appends."""
    for label in _SOURCE_MAP.values():
        suffix = f" - {label}"
        if title.endswith(suffix):
            return title[: -len(suffix)]
    return title


def search_articles(query: str) -> list[dict]:
    if not query or not query.strip():
        return []

    try:
        url = _RSS_URL.format(query=urllib.parse.quote(query.strip()))
        response = httpx.get(url, follow_redirects=True, timeout=10)
        root = ET.fromstring(response.text)
        items = root.findall(".//item")[:_MAX_RESULTS]
    except Exception:
        return []

    results = []
    for item in items:
        link_el = item.find("link")
        title_el = item.find("title")
        if link_el is None or title_el is None:
            continue

        real_url = _resolve_redirect(link_el.text or "")
        if real_url is None:
            continue

        source = _source_label(real_url)
        if source is None:
            continue

        results.append({
            "title": _clean_title(title_el.text or ""),
            "url": real_url,
            "source": source,
        })

    return results
```

- [ ] **Step 4: Run all tests to confirm they pass**

```bash
cd backend && python3 -m pytest tests/test_search.py -v
```

Expected: all 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add backend/searcher.py backend/tests/test_search.py
git commit -m "feat: add searcher module with Google News RSS search"
```

---

### Task 2: `GET /search` endpoint

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/tests/test_api.py`

- [ ] **Step 1: Write the failing endpoint tests**

Append to `backend/tests/test_api.py`:

```python
def test_search_returns_results():
    with patch("main.search_articles", return_value=[
        {"title": "Iran war", "url": "https://www.npr.org/2026/04/04/iran", "source": "NPR"}
    ]):
        response = client.get("/search?q=iran")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0] == {
        "title": "Iran war",
        "url": "https://www.npr.org/2026/04/04/iran",
        "source": "NPR",
    }


def test_search_blank_query_returns_empty_list():
    with patch("main.search_articles", return_value=[]):
        response = client.get("/search?q=")
    assert response.status_code == 200
    assert response.json() == []


def test_search_missing_q_param_returns_empty_list():
    with patch("main.search_articles", return_value=[]):
        response = client.get("/search")
    assert response.status_code == 200
    assert response.json() == []
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && python3 -m pytest tests/test_api.py::test_search_returns_results tests/test_api.py::test_search_blank_query_returns_empty_list tests/test_api.py::test_search_missing_q_param_returns_empty_list -v
```

Expected: FAIL with 404 or 405 (endpoint doesn't exist yet)

- [ ] **Step 3: Add the import and endpoint to `backend/main.py`**

Add after the existing imports (line 13, after `from fetcher import fetch_all`):

```python
from searcher import search_articles
```

Update the CORS middleware to also allow GET requests (the `allow_methods` line):

```python
allow_methods=["GET", "POST"],
```

Add the endpoint after the `/analyze` endpoint (after line 47):

```python
@app.get("/search")
def search_endpoint(q: str = ""):
    return search_articles(q)
```

- [ ] **Step 4: Run full backend test suite**

```bash
cd backend && python3 -m pytest tests/ -v
```

Expected: all tests PASS (existing 5 + new 3)

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_api.py
git commit -m "feat: add GET /search endpoint"
```

---

### Task 3: App — rewrite url-input screen with search UI

**Files:**
- Modify: `app/app/(app)/url-input.tsx`
- Modify: `app/__tests__/url-input.test.tsx`

- [ ] **Step 1: Write the failing tests**

Replace the entire contents of `app/__tests__/url-input.test.tsx`:

```tsx
import React from 'react'
import { render, fireEvent, act, waitFor } from '@testing-library/react-native'
import UrlInputScreen from '../app/(app)/url-input'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('../constants/api', () => ({ API_BASE: 'http://localhost:8000' }))

const SEARCH_RESULTS = [
  {
    title: 'Iran war enters week 6',
    url: 'https://www.npr.org/2026/04/04/iran-war',
    source: 'NPR',
  },
  {
    title: 'Iran: 48 hours ultimatum',
    url: 'https://www.aljazeera.com/news/2026/4/4/iran',
    source: 'Al Jazeera',
  },
  {
    title: 'Iraq drawn into Iran war',
    url: 'https://www.dw.com/en/iraq-iran/a-123',
    source: 'DW',
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

// Renders component, triggers a search, and waits for results to appear.
async function renderWithResults() {
  ;(global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => SEARCH_RESULTS,
  })
  const utils = render(<UrlInputScreen />)
  fireEvent.changeText(utils.getByTestId('search-input'), 'iran')
  act(() => {
    jest.advanceTimersByTime(400)
  })
  await waitFor(() =>
    utils.getByTestId(`result-${SEARCH_RESULTS[0].url}`)
  )
  return utils
}

describe('initial state', () => {
  it('shows only search bar and disabled Analyze button', () => {
    const { getByTestId, queryByTestId } = render(<UrlInputScreen />)
    expect(getByTestId('search-input')).toBeTruthy()
    expect(getByTestId('analyze-button').props.accessibilityState.disabled).toBe(true)
    expect(queryByTestId(`result-${SEARCH_RESULTS[0].url}`)).toBeNull()
  })
})

describe('debounce', () => {
  it('does not call search API before 400ms', () => {
    const { getByTestId } = render(<UrlInputScreen />)
    fireEvent.changeText(getByTestId('search-input'), 'iran')
    jest.advanceTimersByTime(399)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('calls search API with encoded query after 400ms', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    const { getByTestId } = render(<UrlInputScreen />)
    fireEvent.changeText(getByTestId('search-input'), 'iran')
    act(() => {
      jest.advanceTimersByTime(400)
    })
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/search?q=iran'
      )
    )
  })

  it('does not call search API for blank input', () => {
    const { getByTestId } = render(<UrlInputScreen />)
    fireEvent.changeText(getByTestId('search-input'), '   ')
    act(() => {
      jest.advanceTimersByTime(400)
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })
})

describe('results list', () => {
  it('renders title and source badge for each result', async () => {
    const { getByText } = await renderWithResults()
    expect(getByText('Iran war enters week 6')).toBeTruthy()
    expect(getByText('NPR')).toBeTruthy()
    expect(getByText('Iran: 48 hours ultimatum')).toBeTruthy()
    expect(getByText('Al Jazeera')).toBeTruthy()
  })

  it('shows no-results message when API returns empty array', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    })
    const { getByTestId, getByText } = render(<UrlInputScreen />)
    fireEvent.changeText(getByTestId('search-input'), 'xyzzy')
    act(() => {
      jest.advanceTimersByTime(400)
    })
    await waitFor(() => expect(getByText('No results for xyzzy')).toBeTruthy())
  })

  it('shows search unavailable on network error', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network'))
    const { getByTestId, getByText } = render(<UrlInputScreen />)
    fireEvent.changeText(getByTestId('search-input'), 'iran')
    act(() => {
      jest.advanceTimersByTime(400)
    })
    await waitFor(() => expect(getByText('Search unavailable')).toBeTruthy())
  })
})

describe('article selection', () => {
  it('tapping a result adds it as a chip', async () => {
    const { getByTestId } = await renderWithResults()
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[0].url}`))
    expect(getByTestId(`chip-${SEARCH_RESULTS[0].url}`)).toBeTruthy()
  })

  it('selected result has disabled prop set to true', async () => {
    const { getByTestId } = await renderWithResults()
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[0].url}`))
    const resultEl = getByTestId(`result-${SEARCH_RESULTS[0].url}`)
    expect(resultEl.props.disabled).toBe(true)
  })

  it('tapping chip × removes article from selection', async () => {
    const { getByTestId, queryByTestId } = await renderWithResults()
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[0].url}`))
    fireEvent.press(getByTestId(`chip-remove-${SEARCH_RESULTS[0].url}`))
    expect(queryByTestId(`chip-${SEARCH_RESULTS[0].url}`)).toBeNull()
  })
})

describe('analyze button', () => {
  it('is disabled with 1 article selected', async () => {
    const { getByTestId } = await renderWithResults()
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[0].url}`))
    expect(getByTestId('analyze-button').props.accessibilityState.disabled).toBe(true)
  })

  it('is enabled with 2 articles selected', async () => {
    const { getByTestId } = await renderWithResults()
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[0].url}`))
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[1].url}`))
    expect(getByTestId('analyze-button').props.accessibilityState.disabled).toBe(false)
  })

  it('navigates to results screen with selected article URLs', async () => {
    const { getByTestId } = await renderWithResults()
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[0].url}`))
    fireEvent.press(getByTestId(`result-${SEARCH_RESULTS[1].url}`))
    fireEvent.press(getByTestId('analyze-button'))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(app)/results',
      params: {
        urls: JSON.stringify([
          SEARCH_RESULTS[0].url,
          SEARCH_RESULTS[1].url,
        ]),
      },
    })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd app && npx jest __tests__/url-input.test.tsx --no-coverage 2>&1 | tail -15
```

Expected: FAIL — `Unable to find an element with testID: search-input`

- [ ] **Step 3: Rewrite `app/app/(app)/url-input.tsx`**

```tsx
import React, { useState, useEffect } from 'react'
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native'
import { useRouter } from 'expo-router'
import { API_BASE } from '../../constants/api'

const MAX_SOURCES = 3

type SearchResult = {
  title: string
  url: string
  source: string
}

export default function UrlInputScreen() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [selectedArticles, setSelectedArticles] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      setSearchError(null)
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `${API_BASE}/search?q=${encodeURIComponent(query.trim())}`
        )
        const data: SearchResult[] = await res.json()
        setResults(data)
        setSearchError(null)
      } catch {
        setSearchError('Search unavailable')
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query])

  const isSelected = (url: string) =>
    selectedArticles.some(a => a.url === url)

  const toggleSelect = (article: SearchResult) => {
    if (isSelected(article.url) || selectedArticles.length >= MAX_SOURCES) return
    setSelectedArticles(prev => [...prev, article])
  }

  const removeSelected = (url: string) => {
    setSelectedArticles(prev => prev.filter(a => a.url !== url))
  }

  const canAnalyze = selectedArticles.length >= 2

  const handleAnalyze = () => {
    router.push({
      pathname: '/(app)/results',
      params: { urls: JSON.stringify(selectedArticles.map(a => a.url)) },
    })
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
        {searching && (
          <ActivityIndicator style={styles.spinner} size="small" />
        )}
      </View>

      {selectedArticles.map(article => (
        <View
          key={article.url}
          testID={`chip-${article.url}`}
          style={styles.chip}
        >
          <Text style={styles.chipText} numberOfLines={1}>
            {article.source} — {article.title}
          </Text>
          <Pressable
            testID={`chip-remove-${article.url}`}
            onPress={() => removeSelected(article.url)}
          >
            <Text style={styles.chipClose}>×</Text>
          </Pressable>
        </View>
      ))}

      {searchError != null && (
        <Text testID="search-error" style={styles.feedbackText}>
          {searchError}
        </Text>
      )}

      {results.length === 0 &&
        query.trim().length > 0 &&
        !searching &&
        searchError == null && (
          <Text testID="no-results" style={styles.feedbackText}>
            No results for {query.trim()}
          </Text>
        )}

      {results.length > 0 && searchError == null && (
        <FlatList
          testID="results-list"
          data={results}
          keyExtractor={item => item.url}
          renderItem={({ item }) => {
            const selected = isSelected(item.url)
            return (
              <Pressable
                testID={`result-${item.url}`}
                onPress={() => toggleSelect(item)}
                disabled={selected || selectedArticles.length >= MAX_SOURCES}
                style={[styles.result, selected && styles.resultSelected]}
              >
                <Text style={styles.resultTitle}>{item.title}</Text>
                <Text style={styles.resultSource}>{item.source}</Text>
              </Pressable>
            )
          }}
        />
      )}

      <Pressable
        testID="analyze-button"
        disabled={!canAnalyze}
        accessibilityState={{ disabled: !canAnalyze }}
        onPress={handleAnalyze}
        style={[styles.button, !canAnalyze && styles.buttonDisabled]}
      >
        <Text style={styles.buttonText}>Analyze</Text>
      </Pressable>
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F0FE',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 8,
  },
  chipText: { flex: 1, fontSize: 13, color: '#333' },
  chipClose: { fontSize: 18, color: '#666', marginLeft: 8 },
  feedbackText: { color: '#888', fontSize: 13, marginBottom: 8 },
  result: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultSelected: { opacity: 0.4 },
  resultTitle: { fontSize: 14, color: '#111', marginBottom: 2 },
  resultSource: { fontSize: 12, color: '#007AFF', fontWeight: '600' },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
})
```

- [ ] **Step 4: Run the url-input tests**

```bash
cd app && npx jest __tests__/url-input.test.tsx --no-coverage 2>&1 | tail -20
```

Expected: all tests PASS

- [ ] **Step 5: Run full app test suite**

```bash
cd app && npx jest --no-coverage 2>&1 | tail -15
```

Expected: all tests PASS (url-input + results)

- [ ] **Step 6: Commit**

```bash
git add app/app/(app)/url-input.tsx app/__tests__/url-input.test.tsx
git commit -m "feat: replace URL inputs with topic search bar"
```
