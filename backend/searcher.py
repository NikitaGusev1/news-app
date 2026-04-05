from concurrent.futures import ThreadPoolExecutor
from typing import Optional
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


def _resolve_redirect(google_url: str) -> Optional[str]:
    try:
        resp = httpx.head(google_url, follow_redirects=True, timeout=5)
        return str(resp.url)
    except Exception:
        return None


def _source_label(url: str) -> Optional[str]:
    netloc = urllib.parse.urlparse(url).netloc
    for domain, label in _SOURCE_MAP.items():
        if domain in netloc:
            return label
    return None


def _clean_title(title: str) -> str:
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

    candidates = []
    for item in items:
        link_el = item.find("link")
        title_el = item.find("title")
        if link_el is not None and title_el is not None:
            candidates.append((title_el.text or "", link_el.text or ""))

    with ThreadPoolExecutor() as executor:
        resolved_urls = list(executor.map(lambda c: _resolve_redirect(c[1]), candidates))

    results = []
    for (title, _), real_url in zip(candidates, resolved_urls):
        if real_url is None:
            continue
        source = _source_label(real_url)
        if source is None:
            continue
        results.append({
            "title": _clean_title(title),
            "url": real_url,
            "source": source,
        })

    return results
