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


from fetcher import fetch_all


def test_fetch_all_returns_successful_articles():
    def fake_fetch(url):
        return (url.split("//")[1].split(".")[0].capitalize(), f"text from {url}")

    with patch("fetcher.fetch_article", side_effect=fake_fetch):
        results = fetch_all(["https://bbc.com/a", "https://cnn.com/b"])
    assert len(results) == 2


def test_fetch_all_skips_failed_urls():
    def fake_fetch(url):
        if "bad" in url:
            raise ValueError("Failed to fetch")
        return ("Good", "good text")

    with patch("fetcher.fetch_article", side_effect=fake_fetch):
        results = fetch_all(["https://good.com/a", "https://bad.com/b"])
    assert len(results) == 1
    assert results[0][0] == "Good"


def test_fetch_all_preserves_url_order():
    def fake_fetch(url):
        label = url.rstrip("/").split("/")[-1].upper()
        return (label, f"text {url}")

    urls = ["https://example.com/a", "https://example.com/b", "https://example.com/c"]
    with patch("fetcher.fetch_article", side_effect=fake_fetch):
        results = fetch_all(urls)
    assert [label for label, _ in results] == ["A", "B", "C"]


from analyzer import analyze, MODEL, SYSTEM_PROMPT

SAMPLE_RESPONSE_FOR_ANALYZE = """\
1. WHAT ALL SOURCES AGREE ON
Agreed facts here.

2. HOW EACH SOURCE FRAMED IT
Framing details here.

3. LANGUAGE WORTH NOTICING
Loaded phrases here.

4. FACTS ONLY ONE SOURCE REPORTED
Unique claims here.
"""


def test_analyze_returns_sections_and_token_count():
    mock_content = MagicMock()
    mock_content.text = SAMPLE_RESPONSE_FOR_ANALYZE
    mock_usage = MagicMock()
    mock_usage.input_tokens = 100
    mock_usage.output_tokens = 200
    mock_response = MagicMock()
    mock_response.content = [mock_content]
    mock_response.usage = mock_usage
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    with patch("analyzer.anthropic.Anthropic", return_value=mock_client):
        result = analyze([("BBC", "text a"), ("Reuters", "text b")])

    assert "sections" in result
    assert "tokens_used" in result
    assert result["tokens_used"] == 300
    assert "Agreed facts" in result["sections"]["WHAT ALL SOURCES AGREE ON"]


def test_analyze_calls_correct_model_and_system_prompt():
    mock_content = MagicMock()
    mock_content.text = SAMPLE_RESPONSE_FOR_ANALYZE
    mock_usage = MagicMock()
    mock_usage.input_tokens = 50
    mock_usage.output_tokens = 50
    mock_response = MagicMock()
    mock_response.content = [mock_content]
    mock_response.usage = mock_usage
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    with patch("analyzer.anthropic.Anthropic", return_value=mock_client):
        analyze([("BBC", "text a"), ("Reuters", "text b")])

    kwargs = mock_client.messages.create.call_args.kwargs
    assert kwargs["model"] == MODEL
    assert kwargs["max_tokens"] == 4096
    assert kwargs["system"] == SYSTEM_PROMPT
