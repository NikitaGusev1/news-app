import argparse
import sys

from rich.console import Console
from rich.panel import Panel

from analyzer import MODEL, SECTION_HEADERS, analyze
from fetcher import fetch_all


def parse_args() -> list[str]:
    parser = argparse.ArgumentParser(
        description="Compare news coverage of the same story across multiple sources."
    )
    parser.add_argument("urls", nargs="+", metavar="URL", help="2–5 article URLs")
    args = parser.parse_args()
    if not 2 <= len(args.urls) <= 5:
        parser.error(f"Provide between 2 and 5 URLs (got {len(args.urls)})")
    return args.urls


def render_output(
    sections: dict[str, str],
    articles: list[tuple[str, str]],
    urls: list[str],
    input_tokens: int,
    output_tokens: int,
) -> None:
    console = Console()
    for header in SECTION_HEADERS:
        console.print(Panel(sections.get(header, ""), title=f"[bold]{header}[/bold]", expand=True))
    footer = (
        f"Sources: {len(articles)}/{len(urls)} fetched  |  "
        f"Model: {MODEL}  |  "
        f"Tokens: {input_tokens} in / {output_tokens} out"
    )
    console.print(f"\n[dim]{footer}[/dim]")


def main() -> None:
    urls = parse_args()
    articles = fetch_all(urls)
    if len(articles) < 2:
        print(f"Need at least 2 sources to compare, only got {len(articles)}.")
        sys.exit(1)

    result = analyze(articles)
    render_output(result["sections"], articles, urls, result["input_tokens"], result["output_tokens"])


if __name__ == "__main__":
    main()
