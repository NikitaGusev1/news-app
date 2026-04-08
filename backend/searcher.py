from concurrent.futures import ThreadPoolExecutor
import xml.etree.ElementTree as ET
import httpx

_SOURCES = [
    {
        "label": "NPR",
        "feed": "https://feeds.npr.org/1001/rss.xml",
        "ns": None,
    },
    {
        "label": "Al Jazeera",
        "feed": "https://www.aljazeera.com/xml/rss/all.xml",
        "ns": None,
    },
    {
        "label": "DW",
        "feed": "https://rss.dw.com/rdf/rss-en-all",
        "ns": "http://purl.org/rss/1.0/",
    },
]

_HEADERS = {"User-Agent": "Mozilla/5.0"}
_DIGEST_SIZE = 5

_STOPWORDS = {
    "the", "a", "an", "is", "of", "in", "on", "at", "by", "for",
    "with", "to", "and", "or", "that", "this", "it", "as", "are",
    "was", "were", "has", "have", "been", "its",
}


def _significant_words(title: str) -> set[str]:
    return {w for w in title.lower().split() if w.isalpha() and w not in _STOPWORDS}


def _group_articles(items: list[dict]) -> list[dict]:
    groups: list[dict] = []
    for item in items:
        words = _significant_words(item["title"])
        matched = None
        for group in groups:
            if len(words & group["_words"]) >= 2:
                matched = group
                break
        if matched is not None:
            if item["source"] not in matched["sources"]:
                matched["sources"].append(item["source"])
                matched["urls"].append(item["url"])
                matched["_words"] |= words
        else:
            groups.append({
                "title": item["title"],
                "sources": [item["source"]],
                "urls": [item["url"]],
                "_words": words,
            })
    multi = [g for g in groups if len(g["sources"]) > 1]
    multi.sort(key=lambda g: len(g["sources"]), reverse=True)
    return [{"title": g["title"], "sources": g["sources"], "urls": g["urls"]} for g in multi]


def _fetch_source(source: dict) -> list[dict]:
    try:
        resp = httpx.get(source["feed"], follow_redirects=True, timeout=8, headers=_HEADERS)
        root = ET.fromstring(resp.text)
        ns = source["ns"]
        p = f"{{{ns}}}" if ns else ""
        results = []
        for item in root.findall(f".//{p}item"):
            link_el = item.find(f"{p}link")
            title_el = item.find(f"{p}title")
            if link_el is None or title_el is None:
                continue
            url = (link_el.text or "").strip()
            title = (title_el.text or "").strip()
            if url and title:
                results.append({"title": title, "url": url, "source": source["label"]})
        return results
    except Exception:
        return []


def _fetch_all_items() -> list[dict]:
    with ThreadPoolExecutor() as executor:
        all_items_lists = list(executor.map(_fetch_source, _SOURCES))
    return [item for sublist in all_items_lists for item in sublist]


def get_digest() -> list[dict]:
    return _group_articles(_fetch_all_items())[:_DIGEST_SIZE]


def search_articles(query: str) -> list[dict]:
    if not query or not query.strip():
        return []

    terms = query.strip().lower().split()
    groups = _group_articles(_fetch_all_items())
    return [g for g in groups if all(term in g["title"].lower() for term in terms)][:_DIGEST_SIZE]
