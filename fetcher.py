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
