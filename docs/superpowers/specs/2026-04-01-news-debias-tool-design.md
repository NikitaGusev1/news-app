# News Bias Comparison Tool — Design Spec

**Date:** 2026-04-01
**Status:** Approved

---

## What It Does

A CLI tool that accepts 2–5 news article URLs covering the same story, fetches and cleans the article text, and uses Claude to produce a structured comparison showing what sources agree on, how each frames the story differently, and what language choices reveal about bias. Output is printed to the terminal.

---

## Architecture

Two files in the project root:

- **`fetcher.py`** — article fetching and extraction module
- **`news_debias.py`** — CLI entry point, prompt construction, API call, rendering

### Data Flow

```
CLI args (URLs)
    → fetcher.py: fetch + extract + truncate (8,000 chars) + label by domain
    → news_debias.py: bundle articles into single prompt
    → Claude API (claude-sonnet-4-6, one call)
    → parse response into 4 sections
    → rich renderer: structured output + metadata footer
```

---

## Components

### `fetcher.py`

Exposes one public function:

```python
def fetch_article(url: str) -> tuple[str, str]:
    """
    Fetches and extracts clean article text from a URL.
    Returns (domain_label, article_text).
    Raises ValueError with a descriptive message on failure.
    """
```

**Domain label extraction:**
- Parse hostname from URL
- Strip leading `www.`
- Use the second-level domain name, capitalized (e.g. `bbc.co.uk` → `Bbc`, `foxnews.com` → `Foxnews`, `reuters.com` → `Reuters`)

**Article extraction:**
- `trafilatura.fetch_url(url)` to download
- `trafilatura.extract()` to strip HTML and boilerplate
- Truncate to 8,000 characters
- Raise `ValueError` if fetch or extraction returns nothing

---

### `news_debias.py`

**1. CLI argument parsing (`argparse`)**
- Accepts 2–5 positional URL arguments
- Exits with usage message if count is outside that range

**2. Article fetching (parallel)**
- Fetch all URLs concurrently via `concurrent.futures.ThreadPoolExecutor`
- On `ValueError` from fetcher: print warning with the URL, skip, continue
- After all fetches: if fewer than 2 succeeded, exit with message:
  `"Need at least 2 sources to compare, only got N."`

**3. Prompt construction**
- Build a single user message containing each article labelled by domain:
  ```
  --- SOURCE: BBC ---
  <article text>

  --- SOURCE: Reuters ---
  <article text>
  ```

**4. Claude API call**
- Model: `claude-sonnet-4-6`
- One `client.messages.create()` call
- System prompt (see below)

**5. Response parsing**
- Split response text into 4 sections by header:
  1. `WHAT ALL SOURCES AGREE ON`
  2. `HOW EACH SOURCE FRAMED IT`
  3. `LANGUAGE WORTH NOTICING`
  4. `FACTS ONLY ONE SOURCE REPORTED`

**6. Output rendering (`rich`)**
- Each section: bold styled header + plain text content
- Footer: sources fetched / sources provided, model name, input + output token count

---

## System Prompt

```
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
Never editorialize about which source is more trustworthy.
```

---

## Error Handling

| Scenario | Behavior |
|---|---|
| URL fetch or extraction fails | Print warning with URL, skip, continue |
| Fewer than 2 articles fetched | Exit: `"Need at least 2 sources to compare, only got N."` |
| `ANTHROPIC_API_KEY` not set | SDK raises — surface error naturally |
| Claude API error | Print raw error message and exit |
| <2 or >5 URLs passed | `argparse` exits with usage message |

No retries on fetch failure — paywalls and bot-blocks won't be resolved by retrying.

---

## Dependencies

```
anthropic
trafilatura
rich
```

Install: `pip install anthropic trafilatura rich`

Requires `ANTHROPIC_API_KEY` set as environment variable.

---

## Out of Scope

- No `--save` flag
- No UI, database, or server
- No scheduling or automation
- No RSS/keyword fetching
- No paywalled content support
- No `--model` flag (model is fixed)
