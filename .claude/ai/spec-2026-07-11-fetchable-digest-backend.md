---
date: 2026-07-11
author: Codex
status: approved
related_research:
  - .claude/ai/spec-2026-07-11-mvp-product-contract.md
  - docs/superpowers/specs/2026-07-05-fetchable-daily-digest-design.md
---

# Fetchable Digest Backend

## Goal

Add a production-ready MVP `GET /digest` API that returns only story groups with at least two article URLs that can be fetched and extracted by the existing article extraction layer.

## Non-Goals

- No article text cache or `story_id` cache in MVP.
- No manual text fallback.
- No paid search/news API.
- No source expansion beyond the current curated source list unless needed to replace a source that is completely unusable.
- No changes to the `POST /analyze` response contract except bug fixes needed to preserve current behavior.

## Current System

`backend/searcher.py` already defines:

- `_SOURCES` for NPR, Al Jazeera, and DW feeds.
- `_fetch_source(source)` to fetch and parse RSS/RDF feed items.
- `_fetch_all_items()` to fetch all source feeds in parallel.
- `_group_articles(items)` to group stories by significant title-word overlap and exclude single-source groups.
- `get_digest()` to return grouped feed stories, currently without fetchability validation.
- `search_articles(query)` to return individual matching feed items.

`backend/main.py` imports `search_articles` and exposes `GET /search`, but does not expose `GET /digest`.

`fetcher.py` exposes `fetch_article(url)` and `fetch_all(urls)`. Digest validation should reuse this extraction behavior so digest readiness matches analysis readiness.

## Proposed Design

Add fetchability filtering to the digest path and expose it through FastAPI.

### Data Shape

`GET /digest` response:

```json
[
  {
    "title": "Example headline",
    "sources": ["NPR", "DW"],
    "urls": ["https://...", "https://..."]
  }
]
```

Rules:

- `title` remains the representative title from grouping.
- `sources` and `urls` must stay aligned by index.
- Each returned story must have at least two source/url pairs after fetchability filtering.
- Results are capped at 5 stories.

### Searcher Changes

In `backend/searcher.py`:

1. Add a helper that validates one grouped story:

```python
def _filter_fetchable_story(group: dict) -> dict | None:
    ...
```

It should:

- attempt extraction for each URL using `fetch_article()` or a thin wrapper around it;
- preserve only URLs that extract successfully;
- preserve matching source labels;
- return `None` if fewer than two URLs remain;
- never raise for a failed article.

2. Update `get_digest()`:

- fetch feed items;
- group them;
- validate candidate groups in order;
- stop once 5 fetchable groups have been collected;
- return `[]` if feeds or article extraction fail broadly.

3. Keep `search_articles()` behavior stable unless the app spec removes usage from the MVP path. Existing search tests may remain, but search is no longer MVP-critical.

### API Changes

In `backend/main.py`:

- import `get_digest` from `searcher`;
- add:

```python
@app.get("/digest")
def digest_endpoint():
    return get_digest()
```

If `API_SECRET` is enabled, leave `GET /digest` unauthenticated for MVP unless the app already has a public backend requirement. `POST /analyze` should continue to require `X-API-Key` when configured.

## Alternatives Considered

- Validate fetchability by calling `fetch_all(group["urls"])`: simpler, but loses source/url alignment when some fetches fail. A per-URL helper is clearer.
- Return extracted article text in `GET /digest`: rejected because it changes API shape and invites caching concerns.
- Remove `GET /search`: rejected for now to avoid unrelated API deletion; app can simply stop using it.

## Acceptance Criteria

- `GET /digest` exists and returns HTTP 200 with a JSON list.
- Returned stories have `title`, `sources`, and `urls` keys.
- Stories with fewer than two fetchable articles are excluded.
- One failed source/article does not fail the entire digest.
- Digest results are capped at 5 fetchable groups.
- Existing `POST /analyze` behavior remains unchanged.
- Backend tests cover successful digest, filtered single-fetchable story exclusion, partial source failures, cap at 5, and endpoint response shape.

## Risks and Open Questions

- Article extraction can make digest slow. If tests reveal poor behavior, add small candidate caps before fetchability validation.
- Feed parsing currently catches broad exceptions and returns `[]`; this is acceptable for MVP reliability.
- The app may show an empty digest often if the source set is too small. That is a product risk, but not a reason to show unvalidated stories.

## Implementation Notes

Likely files:

- `backend/searcher.py`
- `backend/main.py`
- `backend/tests/test_search.py`
- `backend/tests/test_api.py`

Test with:

```bash
cd backend && python3 -m pytest tests/ -v
```

Use mocks for `fetch_article()` so tests do not perform live article scraping.
