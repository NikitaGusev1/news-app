import pytest
from news_debias import parse_args


def test_parse_args_valid_two_urls(monkeypatch):
    monkeypatch.setattr("sys.argv", ["news_debias.py", "https://a.com", "https://b.com"])
    urls = parse_args()
    assert urls == ["https://a.com", "https://b.com"]


def test_parse_args_valid_five_urls(monkeypatch):
    monkeypatch.setattr("sys.argv", ["news_debias.py"] + [f"https://source{i}.com" for i in range(5)])
    urls = parse_args()
    assert len(urls) == 5


def test_parse_args_too_few_exits(monkeypatch):
    monkeypatch.setattr("sys.argv", ["news_debias.py", "https://a.com"])
    with pytest.raises(SystemExit):
        parse_args()


def test_parse_args_too_many_exits(monkeypatch):
    monkeypatch.setattr("sys.argv", ["news_debias.py"] + [f"https://s{i}.com" for i in range(6)])
    with pytest.raises(SystemExit):
        parse_args()


from news_debias import build_prompt


def test_build_prompt_includes_source_headers():
    articles = [("BBC", "bbc text here"), ("Reuters", "reuters text here")]
    result = build_prompt(articles)
    assert "--- SOURCE: BBC ---" in result
    assert "bbc text here" in result
    assert "--- SOURCE: Reuters ---" in result
    assert "reuters text here" in result


def test_build_prompt_separates_sources():
    articles = [("A", "text a"), ("B", "text b")]
    result = build_prompt(articles)
    # A's section must come before B's
    assert result.index("--- SOURCE: A ---") < result.index("--- SOURCE: B ---")


from unittest.mock import patch
from news_debias import fetch_all


def test_fetch_all_returns_successful_articles():
    def fake_fetch(url):
        return (url.split("//")[1].split(".")[0].capitalize(), f"text from {url}")

    with patch("news_debias.fetch_article", side_effect=fake_fetch):
        results = fetch_all(["https://bbc.com/a", "https://cnn.com/b"])
    assert len(results) == 2


def test_fetch_all_skips_failed_urls():
    def fake_fetch(url):
        if "bad" in url:
            raise ValueError("Failed to fetch https://bad.com/a")
        return ("Good", "good text")

    with patch("news_debias.fetch_article", side_effect=fake_fetch):
        results = fetch_all(["https://good.com/a", "https://bad.com/a"])
    assert len(results) == 1
    assert results[0][0] == "Good"


from news_debias import parse_sections, SECTION_HEADERS

SAMPLE_RESPONSE = """\
1. WHAT ALL SOURCES AGREE ON
The protest occurred on Tuesday. Three people were arrested.

2. HOW EACH SOURCE FRAMED IT
BBC led with the arrests. Reuters focused on the crowd size.

3. LANGUAGE WORTH NOTICING
BBC used "clashes"; Reuters used "demonstrations".

4. FACTS ONLY ONE SOURCE REPORTED
BBC: Police used rubber bullets. (not mentioned by Reuters)
"""


def test_parse_sections_extracts_all_four():
    sections = parse_sections(SAMPLE_RESPONSE)
    assert len(sections) == 4
    for header in SECTION_HEADERS:
        assert header in sections


def test_parse_sections_content_accuracy():
    sections = parse_sections(SAMPLE_RESPONSE)
    assert "Three people were arrested" in sections["WHAT ALL SOURCES AGREE ON"]
    assert "Reuters focused on the crowd size" in sections["HOW EACH SOURCE FRAMED IT"]
    assert "rubber bullets" in sections["FACTS ONLY ONE SOURCE REPORTED"]


def test_parse_sections_missing_header_returns_empty():
    sections = parse_sections("No headers at all in this text.")
    for header in SECTION_HEADERS:
        assert sections[header] == ""


from unittest.mock import MagicMock, patch
from news_debias import main, MODEL, SYSTEM_PROMPT


def test_main_exits_if_fewer_than_2_articles(monkeypatch):
    monkeypatch.setattr("sys.argv", ["news_debias.py", "https://a.com", "https://b.com"])
    with patch("news_debias.fetch_all", return_value=[("BBC", "text")]):
        with pytest.raises(SystemExit):
            main()


def test_main_calls_api_and_renders(monkeypatch):
    monkeypatch.setattr("sys.argv", ["news_debias.py", "https://a.com", "https://b.com"])

    mock_content = MagicMock()
    mock_content.text = (
        "1. WHAT ALL SOURCES AGREE ON\nFact.\n"
        "2. HOW EACH SOURCE FRAMED IT\nFraming.\n"
        "3. LANGUAGE WORTH NOTICING\nLanguage.\n"
        "4. FACTS ONLY ONE SOURCE REPORTED\nUnique.\n"
    )
    mock_usage = MagicMock()
    mock_usage.input_tokens = 100
    mock_usage.output_tokens = 200

    mock_response = MagicMock()
    mock_response.content = [mock_content]
    mock_response.usage = mock_usage

    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_response

    articles = [("Acom", "text a"), ("Bcom", "text b")]

    with patch("news_debias.fetch_all", return_value=articles), \
         patch("news_debias.anthropic.Anthropic", return_value=mock_client):
        main()  # Should not raise

    mock_client.messages.create.assert_called_once()
    call_kwargs = mock_client.messages.create.call_args.kwargs
    assert call_kwargs["model"] == MODEL
    assert call_kwargs["system"] == SYSTEM_PROMPT
