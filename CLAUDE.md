# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Verification

Run the three automated suites independently from the repository root:

```bash
# Shared root modules and retained CLI
pytest tests/ -v

# FastAPI backend
cd backend && python3 -m pytest tests/ -v

# Expo app (Jest with the jest-expo preset)
cd app && npm test -- --runInBand
```

### Backend

```bash
# Run all backend tests (from repo root)
cd backend && python3 -m pytest tests/ -v

# Run a single test file
cd backend && python3 -m pytest tests/test_api.py -v

# Start the FastAPI server
cd backend && ANTHROPIC_API_KEY=your_key uvicorn main:app --reload --port 8000
```

### Root CLI

```bash
# Run all root-level tests
pytest tests/ -v

# Run a single test file
pytest tests/test_fetcher.py -v

# Run the CLI tool
python news_debias.py "https://url1" "https://url2"
```

### Install dependencies

```bash
# Root CLI
pip install anthropic trafilatura rich pytest

# Backend
pip install fastapi "uvicorn[standard]" httpx

# Expo app
cd app && npm install
```

### Environment and local development

- `ANTHROPIC_API_KEY` is required by the backend and root CLI for live Claude analysis.
- `API_SECRET` is the backend's optional shared API secret. When configured, protected requests must provide the matching secret.
- `EXPO_PUBLIC_API_SECRET` supplies that shared secret to the Expo client and must match `API_SECRET`. It is bundled into the client, so it is request gating rather than a private credential.
- `EXPO_PUBLIC_API_BASE` overrides the Expo client's deployed backend URL. Use a host reachable from the target environment: `http://localhost:8000` for an iOS simulator or web development, and the development machine's LAN address for a physical device. Do not append an endpoint path.

Example local startup:

```bash
cd backend && ANTHROPIC_API_KEY=your_key API_SECRET=local-secret uvicorn main:app --reload --port 8000
cd app && EXPO_PUBLIC_API_BASE=http://localhost:8000 EXPO_PUBLIC_API_SECRET=local-secret npm start
```

---

## Architecture

This is a monorepo with two packages sharing Python modules:

```
news-app/
  fetcher.py        # Article fetching — shared by CLI and backend
  analyzer.py       # Prompt construction, Claude API, section parsing — shared
  news_debias.py    # CLI entry point (argparse + rich output)
  tests/            # Tests for CLI modules
  backend/
    main.py         # Thin FastAPI wrapper over shared modules and backend searchers
    conftest.py     # Adds repo root to sys.path for test discovery
    requirements.txt
    tests/
      test_analyzer.py
      test_api.py
  app/
    app/            # Expo Router screens: digest home and analysis results
    components/     # Reusable React Native UI
    __tests__/      # Jest and Testing Library behavior tests
  docs/
    superpowers/
      specs/        # Approved design specs
      plans/        # Implementation plans
```

### Module sharing

`backend/main.py` imports `fetcher` and `analyzer` from the **repo root** (not from inside `backend/`). This is done via `sys.path.insert(0, <repo_root>)` at the top of `main.py` and in `backend/conftest.py`.

There is no separate copy of these modules inside `backend/` — any changes to `fetcher.py` or `analyzer.py` affect both the CLI and the API.

### Core modules

**`fetcher.py`**
- `extract_domain_label(url)` — strips `www.`, capitalises the SLD (e.g. `bbc.co.uk` → `Bbc`)
- `fetch_article(url)` → `(domain_label, text)` — uses `trafilatura`, truncates to 8,000 chars, raises `ValueError` on failure
- `fetch_all(urls)` — parallel fetch via `ThreadPoolExecutor`, skips failures silently, preserves URL order

**`analyzer.py`**
- `build_prompt(articles)` — formats `[(label, text), ...]` as `--- SOURCE: X ---\n...` blocks
- `parse_sections(text)` — splits Claude's response into the 4 named sections by header string
- `analyze(articles)` → `{"sections": {...}, "tokens_used": N}` — single Claude API call using `claude-sonnet-4-6` with `max_tokens=4096`
- Note: `anthropic.Anthropic()` client is instantiated at module import time

**`backend/main.py`**
- Thin FastAPI transport layer over the shared root fetch/analyze modules and backend-local searcher functions
- `GET /digest` builds the fetchable story digest and caches it server-side for the configured cache lifetime
- `GET /search` remains available as a compatibility endpoint for query-based discovery
- `POST /analyze` remains available to fetch and compare an ordered list of article URLs
- Returns 400 when an analysis request yields fewer than 2 successfully fetched articles

**Expo app**
- Expo Router owns navigation between the digest home screen and the results screen
- The home screen loads `GET /digest`; a story is selectable only when it has enough fetchable sources to compare
- Story `sources` and `urls` remain aligned, ordered pairs while unusable entries are filtered
- Navigation uses an Expo Router route object and passes `JSON.stringify(story.urls)` to the results route
- The results screen parses those URLs and calls `POST /analyze`; it renders loading, failure, retry, and structured analysis states
- UI uses React Native `StyleSheet`; tests use Jest, `jest-expo`, and behavior-focused Testing Library assertions

### API contracts

#### `GET /digest`

Returns the mobile MVP's curated, fetchable stories. Each story contains display data plus ordered `sources` and `urls` arrays. Those arrays are an aligned contract: `sources[n]` labels `urls[n]`. The client must preserve that relationship when filtering and navigating. Stories with fewer than two usable URLs cannot start an analysis.

Digest generation may use backend-local search providers and article-fetch checks. The response is cached server-side so normal app refreshes do not repeat all upstream work.

#### `GET /search`

The query-based discovery endpoint is retained for compatibility and backend use. It returns discovered source/URL candidates for a supplied query; it is not the primary mobile MVP entry point.

#### `POST /analyze`

Accepts an ordered URL list:

```json
{
  "urls": ["https://source-one.example/story", "https://source-two.example/story"]
}
```

It calls the shared `fetch_all()` and `analyze()` boundaries and returns:

```json
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
```

The requested and successfully fetched counts can differ because inaccessible articles are skipped. Automated backend tests mock RSS/search, `fetch_article`, `fetch_all`, and analyzer boundaries; they must not call live services.

### Supported compatibility paths and deferred scope

The root `news_debias.py` CLI remains supported for direct URL comparisons, and `GET /search` plus `POST /analyze` remain supported API paths. The fetchable digest in the Expo app is the primary MVP route.

The following are deferred beyond this MVP:

- Manual URL entry in the mobile app
- Search within the already fetched digest
- Persistent/database-backed or distributed caching (the MVP cache is server-side and in-process)
- Saved history, scheduling, notifications, and paywall handling
