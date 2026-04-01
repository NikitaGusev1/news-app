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


def build_prompt(articles: list[tuple[str, str]]) -> str:
    parts = [f"--- SOURCE: {label} ---\n{text}" for label, text in articles]
    return "\n\n".join(parts)


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


def parse_args() -> list[str]:
    parser = argparse.ArgumentParser(
        description="Compare news coverage of the same story across multiple sources."
    )
    parser.add_argument("urls", nargs="+", metavar="URL", help="2–5 article URLs")
    args = parser.parse_args()
    if not 2 <= len(args.urls) <= 5:
        parser.error(f"Provide between 2 and 5 URLs (got {len(args.urls)})")
    return args.urls
