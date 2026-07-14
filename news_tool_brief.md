# News Bias Comparison Tool — Technical Brief

## What It Is
A news comparison product with a fetchable-digest mobile MVP. The Expo app presents current stories assembled by a FastAPI backend, then fetches and compares the selected story's ordered source URLs with an LLM. It shows what sources agree on, how each frames the story, and what language choices reveal about their bias.

The original Python CLI is preserved and supported as a compatibility path for users who already have URLs to compare.

---

## Core Idea
Rather than producing a single "unbiased summary" (which is itself a biased claim), the tool surfaces the *structure of disagreement* between outlets. The user sees the evidence and draws their own conclusions.

---

## Stack
- **Language:** Python 3.11+
- **Article fetching:** `trafilatura` — handles HTML stripping, boilerplate removal, extracts clean article body text from a URL
- **LLM:** Anthropic Claude via the `anthropic` Python SDK (using the model configured by the shared analyzer)
- **Backend:** FastAPI — digest, search compatibility, and article analysis APIs
- **Mobile UI:** React Native with Expo and Expo Router
- **Testing:** pytest for Python; Jest with `jest-expo` and Testing Library for the app
- **Persistence:** no database; the digest uses an in-process server-side cache

---

## Mobile MVP Input / Output

**Input:** The app loads the backend's fetchable digest. A user selects a story with at least two usable source URLs; source names and URLs remain aligned and ordered through filtering and navigation.

**Output:** The results screen shows the same four-part comparison used by the CLI, with loading, error, and retry behavior around the backend request.

The primary flow is:

1. Expo home requests `GET /digest`.
2. The user selects a fetchable story.
3. Expo Router passes `JSON.stringify(story.urls)` in a route object.
4. The results screen calls `POST /analyze` with the parsed ordered URLs.
5. The backend uses the shared fetcher and analyzer and returns the structured sections and request/fetch metadata.

`GET /search` remains available for compatibility, but query search is not the primary product entry point.

## Preserved CLI Input / Output

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

### 1. Digest Discovery and Caching
- Backend-local searchers assemble current story candidates from RSS/search inputs
- Candidate URLs are checked for fetchability before being offered as a comparison
- Source names and URLs are kept as ordered, aligned pairs
- `GET /digest` is cached in process on the server to avoid repeating upstream work on every refresh

### 2. Article Fetching
- Loop over provided URLs
- Use `trafilatura.fetch_url()` + `trafilatura.extract()` to get clean text
- Truncate each article to 8,000 characters to manage token costs
- Gracefully skip and report any URL that fails (paywalled, bot-blocked, etc.)

### 3. Prompt Construction
- Build a single user message containing all article texts, clearly labelled by source domain
- Send with a strict system prompt (see below)
- One API call total, not one per article

### 4. LLM System Prompt (key instructions)
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

### 5. Output Rendering
- Parse LLM response sections by header
- Render mobile results with React Native components and `StyleSheet`
- Preserve terminal rendering with ASCII borders and dividers for the CLI
- Show request/fetch and token metadata where appropriate

---

## Error Handling
- URL fetch failure → skip + warn, continue with remaining URLs
- Fewer than 2 articles fetched → exit with message (comparison needs at least 2 sources)
- API error → surface raw error message

---

## Environment
- Requires `ANTHROPIC_API_KEY` set as environment variable
- `API_SECRET` optionally gates backend requests
- The Expo client uses `API_BASE` for the backend origin and `EXPO_PUBLIC_API_SECRET` to match `API_SECRET`
- A physical device needs an `API_BASE` reachable over the local network; localhost is suitable for web or an iOS simulator

---

## What's Explicitly Out of Scope (for now)
- No database or history
- No scheduling or automation
- No support for paywalled content
- No manual URL input in the mobile app (the root CLI still accepts URLs)
- No search within the already fetched digest
- No persistent or distributed cache beyond the MVP's in-process server-side cache

---

## Future Ideas (not for now)
- `--save` flag to dump output to a `.txt` file with timestamp
- Interactive mode: enter URLs one by one in a prompt loop
- Confidence indicators when only 1 of 4 sources mentions a fact
- Named outlet detection (auto-label sources by domain rather than full URL)
