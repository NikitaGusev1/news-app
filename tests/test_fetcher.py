import pytest
from fetcher import extract_domain_label
from unittest.mock import patch
from fetcher import fetch_article


def test_strips_www_prefix():
    assert extract_domain_label("https://www.bbc.co.uk/news/123") == "Bbc"


def test_no_www_prefix():
    assert extract_domain_label("https://reuters.com/article") == "Reuters"


def test_compound_subdomain():
    assert extract_domain_label("https://www.foxnews.com/story") == "Foxnews"


def test_capitalizes_result():
    assert extract_domain_label("https://apnews.com/article") == "Apnews"


def test_fetch_article_returns_label_and_text():
    with patch("fetcher.trafilatura.fetch_url") as mock_fetch, \
         patch("fetcher.trafilatura.extract") as mock_extract:
        mock_fetch.return_value = "<html>content</html>"
        mock_extract.return_value = "Clean article text here."
        label, text = fetch_article("https://reuters.com/article/123")
        assert label == "Reuters"
        assert text == "Clean article text here."


def test_fetch_article_truncates_to_8000_chars():
    with patch("fetcher.trafilatura.fetch_url") as mock_fetch, \
         patch("fetcher.trafilatura.extract") as mock_extract:
        mock_fetch.return_value = "<html>x</html>"
        mock_extract.return_value = "A" * 20000
        _, text = fetch_article("https://reuters.com/article/123")
        assert len(text) == 8000


def test_fetch_article_raises_on_fetch_failure():
    with patch("fetcher.trafilatura.fetch_url") as mock_fetch:
        mock_fetch.return_value = None
        with pytest.raises(ValueError, match="Failed to fetch"):
            fetch_article("https://reuters.com/article/123")


def test_fetch_article_raises_on_extract_failure():
    with patch("fetcher.trafilatura.fetch_url") as mock_fetch, \
         patch("fetcher.trafilatura.extract") as mock_extract:
        mock_fetch.return_value = "<html>content</html>"
        mock_extract.return_value = None
        with pytest.raises(ValueError, match="Failed to extract"):
            fetch_article("https://reuters.com/article/123")
