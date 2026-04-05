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

_MAX_RESULTS = 10
_HEADERS = {"User-Agent": "Mozilla/5.0"}


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


def search_articles(query: str) -> list[dict]:
    if not query or not query.strip():
        return []

    terms = query.strip().lower().split()

    with ThreadPoolExecutor() as executor:
        all_items_lists = list(executor.map(_fetch_source, _SOURCES))

    all_items = [item for items in all_items_lists for item in items]

    matches = [
        item for item in all_items
        if all(term in item["title"].lower() for term in terms)
    ]

    return matches[:_MAX_RESULTS]
