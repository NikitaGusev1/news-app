# Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the existing Python CLI into a FastAPI backend at `backend/` exposing a single `POST /analyze` endpoint.

**Architecture:** `fetcher.py` is copied unchanged into `backend/`. Analysis logic is extracted from `news_debias.py` into `backend/analyzer.py`. `backend/main.py` is a thin FastAPI wrapper that calls `fetch_all()` then `analyze()` and returns a structured JSON response. The root CLI files are left untouched.

**Tech Stack:** Python 3.11+, FastAPI, uvicorn, pydantic, anthropic, trafilatura, pytest, httpx (for FastAPI TestClient)

---

## File Map

| File | Purpose |
|---|---|
| `backend/fetcher.py` | Copy of root `fetcher.py` — unchanged |
| `backend/analyzer.py` | `build_prompt`, `fetch_all`, `parse_sections`, `analyze` — extracted from `news_debias.py` |
| `backend/main.py` | FastAPI app, `POST /analyze` endpoint, CORS middleware |
| `backend/requirements.txt` | Runtime + dev dependencies |
| `backend/tests/__init__.py` | Empty package marker |
| `backend/tests/test_analyzer.py` | Unit tests for all `analyzer.py` functions |
| `backend/tests/test_api.py` | FastAPI route tests via TestClient |

---

## Task 1: Backend Scaffold

**Files:**
- Create: `backend/fetcher.py`
- Create: `backend/requirements.txt`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Create the `backend/` directory and copy `fetcher.py`**

```bash
mkdir -p backend/tests
cp fetcher.py backend/fetcher.py
touch backend/tests/__init__.py
```

- [ ] **Step 2: Create `backend/requirements.txt`**

```
fastapi
uvicorn[standard]
anthropic
trafilatura
httpx
pytest
```

- [ ] **Step 3: Install backend dependencies**

```bash
pip install fastapi "uvicorn[standard]" httpx
```

(`anthropic` and `trafilatura` are already installed from the root project.)

- [ ] **Step 4: Verify `backend/fetcher.py` imports cleanly**

```bash
cd backend && python3 -c "from fetcher import fetch_article, extract_domain_label; print('OK')"
```

Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "chore: scaffold backend directory with fetcher and requirements"
```

---

## Task 2: `analyzer.py` — Pure Functions

**Files:**
- Create: `backend/analyzer.py`
- Create: `backend/tests/test_analyzer.py`

- [ ] **Step 1: Write failing tests for `build_prompt` and `parse_sections`**

Create `backend/tests/test_analyzer.py`:

```python
import pytest
from unittest.mock import MagicMock, patch

# --- build_prompt ---

from analyzer import build_prompt, SECTION_HEADERS


def test_build_prompt_formats_sources():
    articles = [("BBC", "bbc text"), ("Reuters", "reuters text")]
    result = build_prompt(articles)
    assert "--- SOURCE: BBC ---" in result
    assert "bbc text" in result
    assert "--- SOURCE: Reuters ---" in result
    assert "reuters text" in result


def test_build_prompt_preserves_order():
    articles = [("A", "text a"), ("B", "text b")]
    result = build_prompt(articles)
    assert result.index("--- SOURCE: A ---") < result.index("--- SOURCE: B ---")


# --- parse_sections ---

from analyzer import parse_sections

SAMPLE_RESPONSE = """\
1. WHAT ALL SOURCES AGREE ON
Agreed facts here.

2. HOW EACH SOURCE FRAMED IT
Framing details here.

3. LANGUAGE WORTH NOTICING
Loaded phrases here.

4. FACTS ONLY ONE SOURCE REPORTED
Unique claims here.
"""


def test_parse_sections_extracts_all_four():
    sections = parse_sections(SAMPLE_RESPONSE)
    assert len(sections) == 4
    for header in SECTION_HEADERS:
        assert header in sections


def test_parse_sections_content_accuracy():
    sections = parse_sections(SAMPLE_RESPONSE)
    assert "Agreed facts" in sections["WHAT ALL SOURCES AGREE ON"]
    assert "Framing details" in sections["HOW EACH SOURCE FRAMED IT"]
    assert "Loaded phrases" in sections["LANGUAGE WORTH NOTICING"]
    assert "Unique claims" in sections["FACTS ONLY ONE SOURCE REPORTED"]


def test_parse_sections_missing_header_returns_empty():
    sections = parse_sections("No headers at all.")
    for header in SECTION_HEADERS:
        assert sections[header] == ""
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && python3 -m pytest tests/test_analyzer.py -v
```

Expected: `ModuleNotFoundError: No module named 'analyzer'`

- [ ] **Step 3: Create `backend/analyzer.py`** with the constants and pure functions:

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

import anthropic

from fetcher import fetch_article

MODEL = "claude-sonnet-4-6"

SYSTEM_PROMPT = """\
You are a media analysis tool. Given multiple news articles on the same story,
produce a structured analysis in exactly these four sections:

1. WHAT ALL SOURCES AGREE ON
   List only facts that appear across multiple sources.
   No adjectives implying judgment. Names, dates, numbers, events, direct quotes only.

2. HOW EACH SOURCE FRAMED IT
   For each source, one or two sentences describing the narrative angle,
   what they led with, what they emphasised or de-emphasised.
   Refer to sources by their label (e.g. "BBC", "Reuters") — not by URL.

3. LANGUAGE WORTH NOTICING
   Pull out specific words or phrases from each source that are loaded, emotional,
   or characterising rather than factual.
   Compare against neutral wire-service equivalents where relevant.
   Refer to sources by their label.

4. FACTS ONLY ONE SOURCE REPORTED
   Anything a single source mentions that others don't.
   Label it with the source name. Do not validate or dismiss these claims.

Never use the word "unbiased." Never declare a winner or loser.
Never editorialize about which source is more trustworthy.\
"""

SECTION_HEADERS = [
    "WHAT ALL SOURCES AGREE ON",
    "HOW EACH SOURCE FRAMED IT",
    "LANGUAGE WORTH NOTICING",
    "FACTS ONLY ONE SOURCE REPORTED",
]


def build_prompt(articles: list[tuple[str, str]]) -> str:
    parts = [f"--- SOURCE: {label} ---\n{text}" for label, text in articles]
    return "\n\n".join(parts)


def parse_sections(text: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    for i, header in enumerate(SECTION_HEADERS):
        start = text.find(header)
        if start == -1:
            sections[header] = ""
            continue
        start += len(header)
        next_header = SECTION_HEADERS[i + 1] if i + 1 < len(SECTION_HEADERS) else None
        end = text.find(next_header, start) if next_header else len(text)
        sections[header] = text[start:end].strip()
    return sections
```

- [ ] **Step 4: Run tests**

```bash
cd backend && python3 -m pytest tests/test_analyzer.py -v
```

Expected: 7 passed

- [ ] **Step 5: Commit**

```bash
git add backend/analyzer.py backend/tests/test_analyzer.py
git commit -m "feat: add analyzer.py with build_prompt and parse_sections"
```

---

## Task 3: `analyzer.py` — `fetch_all`

**Files:**
- Modify: `backend/analyzer.py`
- Modify: `backend/tests/test_analyzer.py`

- [ ] **Step 1: Append failing tests to `backend/tests/test_analyzer.py`**

```python
from analyzer import fetch_all


def test_fetch_all_returns_successful_articles():
    def fake_fetch(url):
        return (url.split("//")[1].split(".")[0].capitalize(), f"text from {url}")

    with patch("analyzer.fetch_article", side_effect=fake_fetch):
        results = fetch_all(["https://bbc.com/a", "https://cnn.com/b"])
    assert len(results) == 2


def test_fetch_all_skips_failed_urls():
    def fake_fetch(url):
        if "bad" in url:
            raise ValueError("Failed to fetch")
        return ("Good", "good text")

    with patch("analyzer.fetch_article", side_effect=fake_fetch):
        results = fetch_all(["https://good.com/a", "https://bad.com/b"])
    assert len(results) == 1
    assert results[0][0] == "Good"


def test_fetch_all_preserves_url_order():
    call_order = []

    def fake_fetch(url):
        call_order.append(url)
        return (url[-1].upper(), f"text {url}")

    urls = ["https://a.com", "https://b.com", "https://c.com"]
    with patch("analyzer.fetch_article", side_effect=fake_fetch):
        results = fetch_all(urls)
    assert [label for label, _ in results] == ["A", "B", "C"]
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
cd backend && python3 -m pytest tests/test_analyzer.py -v
```

Expected: 7 passed, 3 failed (`ImportError` on `fetch_all`)

- [ ] **Step 3: Add `fetch_all` to `backend/analyzer.py`** — append after `parse_sections`:

```python
def fetch_all(urls: list[str]) -> list[tuple[str, str]]:
    results: dict[str, tuple[str, str]] = {}
    with ThreadPoolExecutor() as executor:
        futures = {executor.submit(fetch_article, url): url for url in urls}
        for future in as_completed(futures):
            url = futures[future]
            try:
                results[url] = future.result()
            except ValueError:
                pass  # Failed URLs are counted via meta in the API response
    return [results[url] for url in urls if url in results]
```

- [ ] **Step 4: Run tests**

```bash
cd backend && python3 -m pytest tests/test_analyzer.py -v
```

Expected: 10 passed

- [ ] **Step 5: Commit**

```bash
git add backend/analyzer.py backend/tests/test_analyzer.py
git commit -m "feat: add fetch_all to analyzer"
```

---

## Task 4: `analyzer.py` — `analyze()`

**Files:**
- Modify: `backend/analyzer.py`
- Modify: `backend/tests/test_analyzer.py`

- [ ] **Step 1: Append failing tests to `backend/tests/test_analyzer.py`**

```python
from analyzer import analyze, MODEL, SYSTEM_PROMPT


def test_analyze_returns_sections_and_token_count():
    mock_content = MagicMock()
    mock_content.text = SAMPLE_RESPONSE
    mock_usage = MagicMock()
    mock_usage.input_tokens = 100
    mock_usage.output_tokens = 200
    mock_response = MagicMock()
    mock_response.content = [mock_content]
    mock_response.usage = mock_usage
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    with patch("analyzer.anthropic.Anthropic", return_value=mock_client):
        result = analyze([("BBC", "text a"), ("Reuters", "text b")])

    assert "sections" in result
    assert "tokens_used" in result
    assert result["tokens_used"] == 300
    assert "Agreed facts" in result["sections"]["WHAT ALL SOURCES AGREE ON"]


def test_analyze_calls_correct_model_and_system_prompt():
    mock_content = MagicMock()
    mock_content.text = SAMPLE_RESPONSE
    mock_usage = MagicMock()
    mock_usage.input_tokens = 50
    mock_usage.output_tokens = 50
    mock_response = MagicMock()
    mock_response.content = [mock_content]
    mock_response.usage = mock_usage
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    with patch("analyzer.anthropic.Anthropic", return_value=mock_client):
        analyze([("BBC", "text a"), ("Reuters", "text b")])

    kwargs = mock_client.messages.create.call_args.kwargs
    assert kwargs["model"] == MODEL
    assert kwargs["max_tokens"] == 4096
    assert kwargs["system"] == SYSTEM_PROMPT
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
cd backend && python3 -m pytest tests/test_analyzer.py -v
```

Expected: 10 passed, 2 failed (`ImportError` on `analyze`)

- [ ] **Step 3: Add `analyze` to `backend/analyzer.py`** — append at end of file:

```python
def analyze(articles: list[tuple[str, str]]) -> dict:
    """
    Takes list of (domain_label, article_text) tuples.
    Returns {"sections": {...}, "tokens_used": N}.
    """
    prompt = build_prompt(articles)
    client = anthropic.Anthropic()
    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    sections = parse_sections(response.content[0].text)
    return {
        "sections": sections,
        "tokens_used": response.usage.input_tokens + response.usage.output_tokens,
    }
```

- [ ] **Step 4: Run tests**

```bash
cd backend && python3 -m pytest tests/test_analyzer.py -v
```

Expected: 12 passed

- [ ] **Step 5: Commit**

```bash
git add backend/analyzer.py backend/tests/test_analyzer.py
git commit -m "feat: add analyze() to analyzer"
```

---

## Task 5: FastAPI Endpoint

**Files:**
- Create: `backend/main.py`
- Create: `backend/tests/test_api.py`

- [ ] **Step 1: Write failing tests for the API**

Create `backend/tests/test_api.py`:

```python
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

MOCK_SECTIONS = {
    "WHAT ALL SOURCES AGREE ON": "Agreed.",
    "HOW EACH SOURCE FRAMED IT": "Framing.",
    "LANGUAGE WORTH NOTICING": "Language.",
    "FACTS ONLY ONE SOURCE REPORTED": "Unique.",
}
MOCK_ANALYZE_RESULT = {"sections": MOCK_SECTIONS, "tokens_used": 300}


def test_analyze_success_returns_200():
    articles = [("BBC", "text a"), ("Reuters", "text b")]
    with patch("main.fetch_all", return_value=articles), \
         patch("main.analyze", return_value=MOCK_ANALYZE_RESULT):
        response = client.post("/analyze", json={"urls": ["https://bbc.com", "https://reuters.com"]})
    assert response.status_code == 200
    data = response.json()
    assert data["sections"] == MOCK_SECTIONS
    assert data["meta"]["sources_fetched"] == 2
    assert data["meta"]["sources_requested"] == 2
    assert data["meta"]["tokens_used"] == 300


def test_analyze_returns_400_when_fewer_than_2_sources_fetched():
    with patch("main.fetch_all", return_value=[("BBC", "text")]):
        response = client.post("/analyze", json={"urls": ["https://bbc.com", "https://bad.com"]})
    assert response.status_code == 400
    assert "2 sources" in response.json()["detail"]


def test_analyze_returns_422_for_missing_urls_field():
    response = client.post("/analyze", json={})
    assert response.status_code == 422


def test_analyze_meta_reflects_skipped_sources():
    articles = [("BBC", "text a"), ("Reuters", "text b")]  # 2 fetched, 3 requested
    with patch("main.fetch_all", return_value=articles), \
         patch("main.analyze", return_value=MOCK_ANALYZE_RESULT):
        response = client.post(
            "/analyze",
            json={"urls": ["https://bbc.com", "https://reuters.com", "https://bad.com"]},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["meta"]["sources_fetched"] == 2
    assert data["meta"]["sources_requested"] == 3
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && python3 -m pytest tests/test_api.py -v
```

Expected: `ModuleNotFoundError: No module named 'main'`

- [ ] **Step 3: Create `backend/main.py`**

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from analyzer import analyze, fetch_all

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    urls: list[str]


@app.post("/analyze")
def analyze_endpoint(request: AnalyzeRequest):
    articles = fetch_all(request.urls)
    if len(articles) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 2 sources to compare, only got {len(articles)}.",
        )
    result = analyze(articles)
    return {
        "sections": result["sections"],
        "meta": {
            "sources_fetched": len(articles),
            "sources_requested": len(request.urls),
            "tokens_used": result["tokens_used"],
        },
    }
```

- [ ] **Step 4: Run all backend tests**

```bash
cd backend && python3 -m pytest tests/ -v
```

Expected: 16 passed

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/tests/test_api.py
git commit -m "feat: add FastAPI endpoint in backend/main.py"
```

---

## Task 6: Manual Smoke Test

- [ ] **Step 1: Start the server**

```bash
cd backend && ANTHROPIC_API_KEY=your_key uvicorn main:app --reload --port 8000
```

Expected output:
```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
```

- [ ] **Step 2: Test with 2 real URLs (in a separate terminal)**

```bash
curl -s -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://www.cnbc.com/2026/04/01/trump-supreme-court-birthright-citizenship.html", "https://www.nbcnews.com/politics/supreme-court/birthright-citizenship-supreme-court-arguments-trump-executive-order-rcna266011"]}' \
  | python3 -m json.tool | head -30
```

Expected: JSON response with `sections` object containing 4 keys and `meta` object with token counts.

- [ ] **Step 3: Test the 400 response**

```bash
curl -s -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://thisdomaindoesnotexist99999.com/fake", "https://alsobad99999.com/fake"]}' \
  | python3 -m json.tool
```

Expected:
```json
{
    "detail": "Need at least 2 sources to compare, only got 0."
}
```

- [ ] **Step 4: Test the 422 response**

```bash
curl -s -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{}' \
  | python3 -m json.tool
```

Expected: `422 Unprocessable Entity` with validation error detail.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: backend API complete"
```
