import pytest
from unittest.mock import patch, MagicMock

from searcher import search_articles


def make_rss_xml(items):
    """Build a minimal Google News RSS XML string.
    items: list of (title, google_link) tuples.
    """
    item_xml = "".join(
        f"<item><title>{title}</title><link>{link}</link></item>"
        for title, link in items
    )
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        "<rss version=\"2.0\"><channel>" + item_xml + "</channel></rss>"
    )


def mock_get_ok(xml_text):
    m = MagicMock()
    m.text = xml_text
    return m


def mock_head_ok(real_url: str):
    m = MagicMock()
    m.url = real_url
    m.status_code = 200
    return m


@patch("searcher.httpx.head")
@patch("searcher.httpx.get")
def test_returns_shaped_results(mock_get, mock_head):
    xml = make_rss_xml([
        ("Iran war enters week 6 - NPR", "https://news.google.com/rss/articles/abc"),
        ("Iran: civilians at risk - Al Jazeera", "https://news.google.com/rss/articles/def"),
    ])
    mock_get.return_value = mock_get_ok(xml)
    mock_head.side_effect = [
        mock_head_ok("https://www.npr.org/2026/04/04/nx-s1-5773436/iran-war"),
        mock_head_ok("https://www.aljazeera.com/news/2026/4/4/iran-civilians"),
    ]

    results = search_articles("iran")

    assert len(results) == 2
    assert results[0] == {
        "title": "Iran war enters week 6",
        "url": "https://www.npr.org/2026/04/04/nx-s1-5773436/iran-war",
        "source": "NPR",
    }
    assert results[1] == {
        "title": "Iran: civilians at risk",
        "url": "https://www.aljazeera.com/news/2026/4/4/iran-civilians",
        "source": "Al Jazeera",
    }


@patch("searcher.httpx.head")
@patch("searcher.httpx.get")
def test_dw_source_label(mock_get, mock_head):
    xml = make_rss_xml([
        ("Ukraine update - DW", "https://news.google.com/rss/articles/ghi"),
    ])
    mock_get.return_value = mock_get_ok(xml)
    mock_head.return_value = mock_head_ok("https://www.dw.com/en/ukraine/a-12345")

    results = search_articles("ukraine")

    assert results[0]["source"] == "DW"
    assert results[0]["url"] == "https://www.dw.com/en/ukraine/a-12345"


def test_blank_query_returns_empty_without_http():
    with patch("searcher.httpx.get") as mock_get, \
         patch("searcher.httpx.head") as mock_head:
        assert search_articles("") == []
        assert search_articles("   ") == []
        mock_get.assert_not_called()
        mock_head.assert_not_called()


@patch("searcher.httpx.get")
def test_network_error_returns_empty(mock_get):
    mock_get.side_effect = Exception("connection refused")
    assert search_articles("iran") == []


@patch("searcher.httpx.head")
@patch("searcher.httpx.get")
def test_results_capped_at_10(mock_get, mock_head):
    items = [
        (f"Article {i} - NPR", f"https://news.google.com/rss/articles/{i}")
        for i in range(15)
    ]
    mock_get.return_value = mock_get_ok(make_rss_xml(items))
    mock_head.side_effect = [
        mock_head_ok(f"https://www.npr.org/article-{i}") for i in range(15)
    ]

    results = search_articles("news")
    assert len(results) == 10


@patch("searcher.httpx.head")
@patch("searcher.httpx.get")
def test_skips_failed_redirects(mock_get, mock_head):
    xml = make_rss_xml([
        ("Article A - NPR", "https://news.google.com/rss/articles/good"),
        ("Article B - NPR", "https://news.google.com/rss/articles/bad"),
    ])
    mock_get.return_value = mock_get_ok(xml)
    mock_head.side_effect = [
        mock_head_ok("https://www.npr.org/article-a"),
        Exception("timeout"),
    ]

    results = search_articles("test")
    assert len(results) == 1
    assert results[0]["title"] == "Article A"
