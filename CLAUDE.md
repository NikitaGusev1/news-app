# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

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
```

Requires `ANTHROPIC_API_KEY` set as an environment variable for any live API calls.

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
    main.py         # FastAPI app — thin wrapper calling fetch_all() + analyze()
    conftest.py     # Adds repo root to sys.path for test discovery
    requirements.txt
    tests/
      test_analyzer.py
      test_api.py
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
- Single endpoint: `POST /analyze` — accepts `{"urls": [...]}`, calls `fetch_all()` then `analyze()`, returns sections + meta
- Returns 400 if fewer than 2 articles fetched successfully
- CORS middleware with `allow_origins=["*"]`

### API response shape

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

### Frontend (not yet built)

A React Native (Expo) app is planned — spec at `docs/superpowers/specs/2026-04-04-react-native-app-design.md`. It will live at `app/` in the repo root and communicate with the backend at `http://localhost:8000`.
