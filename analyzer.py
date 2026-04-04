import anthropic

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

client = anthropic.Anthropic()


def build_prompt(articles: list[tuple[str, str]]) -> str:
    parts = [f"--- SOURCE: {label} ---\n{text}" for label, text in articles]
    return "\n\n".join(parts)


def parse_sections(text: str) -> dict[str, str]:
    sections: dict[str, str] = {}
    for i, header in enumerate(SECTION_HEADERS):
        start = text.find(header)
        if start == -1:
            sections[header] = ""
            continue
        start += len(header)
        next_header = SECTION_HEADERS[i + 1] if i + 1 < len(SECTION_HEADERS) else None
        end = text.find(next_header, start) if next_header else len(text)
        sections[header] = text[start:end].strip()
    return sections


def analyze(articles: list[tuple[str, str]]) -> dict:
    prompt = build_prompt(articles)
    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    sections = parse_sections(response.content[0].text)
    return {
        "sections": sections,
        "input_tokens": response.usage.input_tokens,
        "output_tokens": response.usage.output_tokens,
        "tokens_used": response.usage.input_tokens + response.usage.output_tokens,
    }
