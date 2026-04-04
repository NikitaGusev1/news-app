import pytest
from unittest.mock import MagicMock, patch

from analyzer import build_prompt, SECTION_HEADERS


def test_build_prompt_formats_sources():
    articles = [("BBC", "bbc text"), ("Reuters", "reuters text")]
    result = build_prompt(articles)
    assert "--- SOURCE: BBC ---" in result
    assert "bbc text" in result
    assert "--- SOURCE: Reuters ---" in result
    assert "reuters text" in result


def test_build_prompt_preserves_order():
    articles = [("A", "text a"), ("B", "text b")]
    result = build_prompt(articles)
    assert result.index("--- SOURCE: A ---") < result.index("--- SOURCE: B ---")


from analyzer import parse_sections

SAMPLE_RESPONSE = """\
1. WHAT ALL SOURCES AGREE ON
Agreed facts here.

2. HOW EACH SOURCE FRAMED IT
Framing details here.

3. LANGUAGE WORTH NOTICING
Loaded phrases here.

4. FACTS ONLY ONE SOURCE REPORTED
Unique claims here.
"""


def test_parse_sections_extracts_all_four():
    sections = parse_sections(SAMPLE_RESPONSE)
    assert len(sections) == 4
    for header in SECTION_HEADERS:
        assert header in sections


def test_parse_sections_content_accuracy():
    sections = parse_sections(SAMPLE_RESPONSE)
    assert "Agreed facts" in sections["WHAT ALL SOURCES AGREE ON"]
    assert "Framing details" in sections["HOW EACH SOURCE FRAMED IT"]
    assert "Loaded phrases" in sections["LANGUAGE WORTH NOTICING"]
    assert "Unique claims" in sections["FACTS ONLY ONE SOURCE REPORTED"]


def test_parse_sections_missing_header_returns_empty():
    sections = parse_sections("No headers at all.")
    for header in SECTION_HEADERS:
        assert sections[header] == ""
