# News Bias Comparison Tool — Technical Brief

## What It Is
A CLI tool that takes multiple URLs covering the same news story, fetches the full article text, and uses an LLM to produce a structured comparison showing what sources agree on, how each one frames the story differently, and what language choices reveal about their bias.

---

## Core Idea
Rather than producing a single "unbiased summary" (which is itself a biased claim), the tool surfaces the *structure of disagreement* between outlets. The user sees the evidence and draws their own conclusions.

---

## Stack
- **Language:** Python 3.11+
- **Article fetching:** `trafilatura` — handles HTML stripping, boilerplate removal, extracts clean article body text from a URL
- **LLM:** Anthropic Claude via `anthropic` Python SDK (`claude-opus-4-6`)
- **No database, no server, no UI** — pure CLI

---

## Input / Output

**Input:** 2–5 URLs passed as CLI arguments
```
python news_debias.py https://bbc.com/... https://foxnews.com/... https://reuters.com/...
```

**Output:** Printed to terminal in this structure:

```
WHAT ALL SOURCES AGREE ON
─────────────────────────
[Verifiable facts present across all or most sources]

HOW EACH SOURCE FRAMED IT
─────────────────────────
Source 1 → [1-2 sentence framing summary]
Source 2 → [1-2 sentence framing summary]
Source 3 → [1-2 sentence framing summary]

LANGUAGE WORTH NOTICING
────────────────────────
Source 1 used: [loaded/charged words or phrases]
Source 2 used: [loaded/charged words or phrases]
Source 3 used: [neutral/wire-service language]

FACTS ONLY ONE SOURCE REPORTED
────────────────────────────────
[Claims or details not corroborated by other sources, with attribution]
```

---

## Architecture

### 1. Article Fetching
- Loop over provided URLs
- Use `trafilatura.fetch_url()` + `trafilatura.extract()` to get clean text
- Truncate each article to ~4000 chars to manage token costs
- Gracefully skip and report any URL that fails (paywalled, bot-blocked, etc.)

### 2. Prompt Construction
- Build a single user message containing all article texts, clearly labelled by source URL
- Send with a strict system prompt (see below)
- One API call total, not one per article

### 3. LLM System Prompt (key instructions)
```
You are a media analysis tool. Given multiple news articles on the same story:

1. WHAT ALL SOURCES AGREE ON — list only facts that appear across multiple sources. 
   No adjectives implying judgment. Names, dates, numbers, events, direct quotes only.

2. HOW EACH SOURCE FRAMED IT — for each source, one or two sentences describing 
   the narrative angle, what they led with, what they emphasised or de-emphasised.

3. LANGUAGE WORTH NOTICING — pull out specific words or phrases from each source 
   that are loaded, emotional, or characterising rather than factual. 
   Compare against neutral wire-service equivalents.

4. FACTS ONLY ONE SOURCE REPORTED — anything a single source mentions that others 
   don't. Label it with the source. Do not validate or dismiss these claims.

Never use the word "unbiased." Never declare a winner or loser. 
Never editorialize about which source is more trustworthy.
```

### 4. Output Rendering
- Parse LLM response sections by header
- Print with simple ASCII borders and dividers
- Show metadata footer: sources fetched / sources provided, model used, token count

---

## Error Handling
- URL fetch failure → skip + warn, continue with remaining URLs
- Fewer than 2 articles fetched → exit with message (comparison needs at least 2 sources)
- API error → surface raw error message

---

## Environment
- Requires `ANTHROPIC_API_KEY` set as environment variable
- Dependencies: `anthropic`, `trafilatura`
- Install: `pip install anthropic trafilatura`

---

## What's Explicitly Out of Scope (for now)
- No UI
- No database or history
- No scheduling or automation
- No RSS/keyword-based fetching — URLs are always provided manually
- No support for paywalled content

---

## Future Ideas (not for now)
- `--save` flag to dump output to a `.txt` file with timestamp
- Interactive mode: enter URLs one by one in a prompt loop
- Confidence indicators when only 1 of 4 sources mentions a fact
- Named outlet detection (auto-label sources by domain rather than full URL)
