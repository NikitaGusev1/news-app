# News Bias Comparison Tool — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python CLI that accepts 2–5 news article URLs and prints a structured bias comparison using Claude.

**Architecture:** Two modules — `fetcher.py` handles URL fetching, text extraction, and domain labelling; `news_debias.py` is the CLI entry point that orchestrates fetching, prompt construction, the Claude API call, and `rich`-formatted output. Tests live in `tests/`.

**Tech Stack:** Python 3.11+, `anthropic`, `trafilatura`, `rich`, `pytest`, `concurrent.futures` (stdlib)

---

## File Map

| File | Purpose |
|---|---|
| `requirements.txt` | Pinned runtime dependencies |
| `.gitignore` | Standard Python ignores |
| `fetcher.py` | `extract_domain_label()` + `fetch_article()` |
| `news_debias.py` | CLI args, parallel fetch, prompt, API call, render |
| `tests/__init__.py` | Empty — marks tests as a package |
| `tests/test_fetcher.py` | Unit tests for fetcher module |
| `tests/test_news_debias.py` | Unit tests for main module functions |

---

## Task 1: Project Setup

**Files:**
- Create: `requirements.txt`
- Create: `.gitignore`
- Create: `tests/__init__.py`

- [ ] **Step 1: Create `requirements.txt`**

```
anthropic
trafilatura
rich
pytest
```

- [ ] **Step 2: Create `.gitignore`**

```
__pycache__/
*.pyc
*.pyo
.env
venv/
.venv/
*.egg-info/
dist/
build/
.pytest_cache/
```

- [ ] **Step 3: Create empty test package marker**

```bash
mkdir -p tests && touch tests/__init__.py
```

- [ ] **Step 4: Install dependencies**

```bash
pip install anthropic trafilatura rich pytest
```

- [ ] **Step 5: Initialize git and commit**

```bash
git init
git add requirements.txt .gitignore tests/__init__.py
git commit -m "chore: project setup"
```

---

## Task 2: Domain Label Extraction

**Files:**
- Create: `fetcher.py`
- Create: `tests/test_fetcher.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_fetcher.py`:

```python
import pytest
from fetcher import extract_domain_label


def test_strips_www_prefix():
    assert extract_domain_label("https://www.bbc.co.uk/news/123") == "Bbc"


def test_no_www_prefix():
    assert extract_domain_label("https://reuters.com/article") == "Reuters"


def test_compound_subdomain():
    assert extract_domain_label("https://www.foxnews.com/story") == "Foxnews"


def test_capitalizes_result():
    assert extract_domain_label("https://apnews.com/article") == "Apnews"
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_fetcher.py -v
```

Expected: `ModuleNotFoundError: No module named 'fetcher'`

- [ ] **Step 3: Create `fetcher.py` with `extract_domain_label`**

```python
from urllib.parse import urlparse


def extract_domain_label(url: str) -> str:
    hostname = urlparse(url).hostname or ""
    if hostname.startswith("www."):
        hostname = hostname[4:]
    sld = hostname.split(".")[0]
    return sld.capitalize()
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pytest tests/test_fetcher.py -v
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add fetcher.py tests/test_fetcher.py
git commit -m "feat: add extract_domain_label to fetcher"
```

---

## Task 3: Article Fetching

**Files:**
- Modify: `fetcher.py`
- Modify: `tests/test_fetcher.py`

- [ ] **Step 1: Add failing tests for `fetch_article`**

Append to `tests/test_fetcher.py`:

```python
from unittest.mock import patch
from fetcher import fetch_article


def test_fetch_article_returns_label_and_text():
    with patch("fetcher.trafilatura.fetch_url") as mock_fetch, \
         patch("fetcher.trafilatura.extract") as mock_extract:
        mock_fetch.return_value = "<html>content</html>"
        mock_extract.return_value = "Clean article text here."
        label, text = fetch_article("https://reuters.com/article/123")
        assert label == "Reuters"
        assert text == "Clean article text here."


def test_fetch_article_truncates_to_8000_chars():
    with patch("fetcher.trafilatura.fetch_url") as mock_fetch, \
         patch("fetcher.trafilatura.extract") as mock_extract:
        mock_fetch.return_value = "<html>x</html>"
        mock_extract.return_value = "A" * 20000
        _, text = fetch_article("https://reuters.com/article/123")
        assert len(text) == 8000


def test_fetch_article_raises_on_fetch_failure():
    with patch("fetcher.trafilatura.fetch_url") as mock_fetch:
        mock_fetch.return_value = None
        with pytest.raises(ValueError, match="Failed to fetch"):
            fetch_article("https://reuters.com/article/123")


def test_fetch_article_raises_on_extract_failure():
    with patch("fetcher.trafilatura.fetch_url") as mock_fetch, \
         patch("fetcher.trafilatura.extract") as mock_extract:
        mock_fetch.return_value = "<html>content</html>"
        mock_extract.return_value = None
        with pytest.raises(ValueError, match="Failed to extract"):
            fetch_article("https://reuters.com/article/123")
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
pytest tests/test_fetcher.py -v
```

Expected: 4 passed, 4 failed (`ImportError` or `AttributeError` on `fetch_article`)

- [ ] **Step 3: Add `fetch_article` to `fetcher.py`**

```python
from urllib.parse import urlparse

import trafilatura


def extract_domain_label(url: str) -> str:
    hostname = urlparse(url).hostname or ""
    if hostname.startswith("www."):
        hostname = hostname[4:]
    sld = hostname.split(".")[0]
    return sld.capitalize()


def fetch_article(url: str) -> tuple[str, str]:
    """
    Fetches and extracts clean article text from a URL.
    Returns (domain_label, article_text).
    Raises ValueError with a descriptive message on failure.
    """
    label = extract_domain_label(url)
    downloaded = trafilatura.fetch_url(url)
    if downloaded is None:
        raise ValueError(f"Failed to fetch {url}")
    text = trafilatura.extract(downloaded)
    if not text:
        raise ValueError(f"Failed to extract article text from {url}")
    return label, text[:8000]
```

- [ ] **Step 4: Run all tests**

```bash
pytest tests/test_fetcher.py -v
```

Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add fetcher.py tests/test_fetcher.py
git commit -m "feat: add fetch_article to fetcher"
```

---

## Task 4: CLI Argument Parsing

**Files:**
- Create: `news_debias.py`
- Create: `tests/test_news_debias.py`

- [ ] **Step 1: Write failing tests**

Create `tests/test_news_debias.py`:

```python
import pytest
from news_debias import parse_args


def test_parse_args_valid_two_urls(monkeypatch):
    monkeypatch.setattr("sys.argv", ["news_debias.py", "https://a.com", "https://b.com"])
    urls = parse_args()
    assert urls == ["https://a.com", "https://b.com"]


def test_parse_args_valid_five_urls(monkeypatch):
    monkeypatch.setattr("sys.argv", ["news_debias.py"] + [f"https://source{i}.com" for i in range(5)])
    urls = parse_args()
    assert len(urls) == 5


def test_parse_args_too_few_exits(monkeypatch):
    monkeypatch.setattr("sys.argv", ["news_debias.py", "https://a.com"])
    with pytest.raises(SystemExit):
        parse_args()


def test_parse_args_too_many_exits(monkeypatch):
    monkeypatch.setattr("sys.argv", ["news_debias.py"] + [f"https://s{i}.com" for i in range(6)])
    with pytest.raises(SystemExit):
        parse_args()
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_news_debias.py -v
```

Expected: `ModuleNotFoundError: No module named 'news_debias'`

- [ ] **Step 3: Create `news_debias.py` with `parse_args`**

```python
import argparse
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

import anthropic
from rich.console import Console
from rich.panel import Panel

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


def parse_args() -> list[str]:
    parser = argparse.ArgumentParser(
        description="Compare news coverage of the same story across multiple sources."
    )
    parser.add_argument("urls", nargs="+", metavar="URL", help="2–5 article URLs")
    args = parser.parse_args()
    if not 2 <= len(args.urls) <= 5:
        parser.error(f"Provide between 2 and 5 URLs (got {len(args.urls)})")
    return args.urls
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_news_debias.py -v
```

Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add news_debias.py tests/test_news_debias.py
git commit -m "feat: add CLI arg parsing to news_debias"
```

---

## Task 5: Prompt Construction

**Files:**
- Modify: `news_debias.py`
- Modify: `tests/test_news_debias.py`

- [ ] **Step 1: Add failing tests**

Append to `tests/test_news_debias.py`:

```python
from news_debias import build_prompt


def test_build_prompt_includes_source_headers():
    articles = [("BBC", "bbc text here"), ("Reuters", "reuters text here")]
    result = build_prompt(articles)
    assert "--- SOURCE: BBC ---" in result
    assert "bbc text here" in result
    assert "--- SOURCE: Reuters ---" in result
    assert "reuters text here" in result


def test_build_prompt_separates_sources():
    articles = [("A", "text a"), ("B", "text b")]
    result = build_prompt(articles)
    # A's section must come before B's
    assert result.index("--- SOURCE: A ---") < result.index("--- SOURCE: B ---")
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_news_debias.py -v
```

Expected: 2 new failures (`ImportError` on `build_prompt`)

- [ ] **Step 3: Add `build_prompt` to `news_debias.py`**

Add after the `SECTION_HEADERS` list:

```python
def build_prompt(articles: list[tuple[str, str]]) -> str:
    parts = [f"--- SOURCE: {label} ---\n{text}" for label, text in articles]
    return "\n\n".join(parts)
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_news_debias.py -v
```

Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add news_debias.py tests/test_news_debias.py
git commit -m "feat: add build_prompt to news_debias"
```

---

## Task 6: Parallel Article Fetching

**Files:**
- Modify: `news_debias.py`
- Modify: `tests/test_news_debias.py`

- [ ] **Step 1: Add failing tests**

Append to `tests/test_news_debias.py`:

```python
from unittest.mock import patch
from news_debias import fetch_all


def test_fetch_all_returns_successful_articles():
    def fake_fetch(url):
        return (url.split("//")[1].split(".")[0].capitalize(), f"text from {url}")

    with patch("news_debias.fetch_article", side_effect=fake_fetch):
        results = fetch_all(["https://bbc.com/a", "https://cnn.com/b"])
    assert len(results) == 2


def test_fetch_all_skips_failed_urls(capsys):
    def fake_fetch(url):
        if "bad" in url:
            raise ValueError("Failed to fetch https://bad.com/a")
        return ("Good", "good text")

    with patch("news_debias.fetch_article", side_effect=fake_fetch):
        results = fetch_all(["https://good.com/a", "https://bad.com/a"])
    assert len(results) == 1
    assert results[0][0] == "Good"
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_news_debias.py -v
```

Expected: 2 new failures (`ImportError` on `fetch_all`)

- [ ] **Step 3: Add `fetch_all` to `news_debias.py`**

Add after `build_prompt`:

```python
def fetch_all(urls: list[str]) -> list[tuple[str, str]]:
    console = Console(stderr=True)
    results: dict[str, tuple[str, str]] = {}
    with ThreadPoolExecutor() as executor:
        futures = {executor.submit(fetch_article, url): url for url in urls}
        for future in as_completed(futures):
            url = futures[future]
            try:
                results[url] = future.result()
            except ValueError as exc:
                console.print(f"[yellow]Warning:[/yellow] Skipping {url}: {exc}")
    # Preserve original URL order
    return [results[url] for url in urls if url in results]
```

- [ ] **Step 4: Run tests**

```bash
pytest tests/test_news_debias.py -v
```

Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add news_debias.py tests/test_news_debias.py
git commit -m "feat: add parallel fetch_all to news_debias"
```

---

## Task 7: Response Section Parsing

**Files:**
- Modify: `news_debias.py`
- Modify: `tests/test_news_debias.py`

- [ ] **Step 1: Add failing tests**

Append to `tests/test_news_debias.py`:

```python
from news_debias import parse_sections, SECTION_HEADERS

SAMPLE_RESPONSE = """\
1. WHAT ALL SOURCES AGREE ON
The protest occurred on Tuesday. Three people were arrested.

2. HOW EACH SOURCE FRAMED IT
BBC led with the arrests. Reuters focused on the crowd size.

3. LANGUAGE WORTH NOTICING
BBC used "clashes"; Reuters used "demonstrations".

4. FACTS ONLY ONE SOURCE REPORTED
BBC: Police used rubber bullets. (not mentioned by Reuters)
"""


def test_parse_sections_extracts_all_four():
    sections = parse_sections(SAMPLE_RESPONSE)
    assert len(sections) == 4
    for header in SECTION_HEADERS:
        assert header in sections


def test_parse_sections_content_accuracy():
    sections = parse_sections(SAMPLE_RESPONSE)
    assert "Three people were arrested" in sections["WHAT ALL SOURCES AGREE ON"]
    assert "Reuters focused on the crowd size" in sections["HOW EACH SOURCE FRAMED IT"]
    assert "rubber bullets" in sections["FACTS ONLY ONE SOURCE REPORTED"]


def test_parse_sections_missing_header_returns_empty():
    sections = parse_sections("No headers at all in this text.")
    for header in SECTION_HEADERS:
        assert sections[header] == ""
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_news_debias.py -v
```

Expected: 3 new failures (`ImportError` on `parse_sections`)

- [ ] **Step 3: Add `parse_sections` to `news_debias.py`**

Add after `fetch_all`:

```python
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
pytest tests/test_news_debias.py -v
```

Expected: 11 passed

- [ ] **Step 5: Commit**

```bash
git add news_debias.py tests/test_news_debias.py
git commit -m "feat: add parse_sections to news_debias"
```

---

## Task 8: Output Rendering and Main Entry Point

**Files:**
- Modify: `news_debias.py`
- Modify: `tests/test_news_debias.py`

- [ ] **Step 1: Add failing tests**

Append to `tests/test_news_debias.py`:

```python
from unittest.mock import MagicMock, patch
from news_debias import main, MODEL, SYSTEM_PROMPT


def test_main_exits_if_fewer_than_2_articles(monkeypatch):
    monkeypatch.setattr("sys.argv", ["news_debias.py", "https://a.com", "https://b.com"])
    with patch("news_debias.fetch_all", return_value=[("BBC", "text")]):
        with pytest.raises(SystemExit):
            main()


def test_main_calls_api_and_renders(monkeypatch):
    monkeypatch.setattr("sys.argv", ["news_debias.py", "https://a.com", "https://b.com"])

    mock_content = MagicMock()
    mock_content.text = (
        "1. WHAT ALL SOURCES AGREE ON\nFact.\n"
        "2. HOW EACH SOURCE FRAMED IT\nFraming.\n"
        "3. LANGUAGE WORTH NOTICING\nLanguage.\n"
        "4. FACTS ONLY ONE SOURCE REPORTED\nUnique.\n"
    )
    mock_usage = MagicMock()
    mock_usage.input_tokens = 100
    mock_usage.output_tokens = 200

    mock_response = MagicMock()
    mock_response.content = [mock_content]
    mock_response.usage = mock_usage

    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    articles = [("Acom", "text a"), ("Bcom", "text b")]

    with patch("news_debias.fetch_all", return_value=articles), \
         patch("news_debias.anthropic.Anthropic", return_value=mock_client):
        main()  # Should not raise

    mock_client.messages.create.assert_called_once()
    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert call_kwargs["model"] == MODEL
    assert call_kwargs["system"] == SYSTEM_PROMPT
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pytest tests/test_news_debias.py -v
```

Expected: 2 new failures (`ImportError` on `main` or missing `render_output`)

- [ ] **Step 3: Add `render_output` and `main` to `news_debias.py`**

Append to `news_debias.py`:

```python
def render_output(
    sections: dict[str, str],
    articles: list[tuple[str, str]],
    urls: list[str],
    usage: object,
) -> None:
    console = Console()
    for header in SECTION_HEADERS:
        console.print(Panel(sections.get(header, ""), title=f"[bold]{header}[/bold]", expand=True))
    footer = (
        f"Sources: {len(articles)}/{len(urls)} fetched  |  "
        f"Model: {MODEL}  |  "
        f"Tokens: {usage.input_tokens} in / {usage.output_tokens} out"
    )
    console.print(f"\n[dim]{footer}[/dim]")


def main() -> None:
    urls = parse_args()
    articles = fetch_all(urls)
    if len(articles) < 2:
        print(f"Need at least 2 sources to compare, only got {len(articles)}.")
        sys.exit(1)

    prompt = build_prompt(articles)
    client = anthropic.Anthropic()
    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    text = response.content[0].text
    sections = parse_sections(text)
    render_output(sections, articles, urls, response.usage)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run all tests**

```bash
pytest tests/ -v
```

Expected: 13 passed, 0 failed

- [ ] **Step 5: Commit**

```bash
git add news_debias.py tests/test_news_debias.py
git commit -m "feat: add render_output and main to news_debias"
```

---

## Task 9: Manual Smoke Test

- [ ] **Step 1: Set your API key**

```bash
export ANTHROPIC_API_KEY=your_key_here
```

- [ ] **Step 2: Run with 2 real URLs on the same story**

```bash
python news_debias.py \
  "https://www.bbc.co.uk/news/articles/REPLACE_WITH_REAL" \
  "https://www.reuters.com/REPLACE_WITH_REAL"
```

Expected: Four `rich` panels appear — Agreed Facts, Framing, Language, Unique Claims — followed by a dim footer showing token counts.

- [ ] **Step 3: Test fetch failure handling**

```bash
python news_debias.py \
  "https://thisdomaindoesnotexist99999.com/fake" \
  "https://www.reuters.com/REPLACE_WITH_REAL"
```

Expected: Yellow warning for the bad URL, then exit with "Need at least 2 sources to compare, only got 1."

- [ ] **Step 4: Test argument validation**

```bash
python news_debias.py "https://only-one.com"
```

Expected: argparse error message + usage, exit code 2.

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: news bias comparison tool complete"
```
