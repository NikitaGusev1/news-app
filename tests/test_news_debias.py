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


def test_fetch_all_skips_failed_urls(capsys):
    def fake_fetch(url):
        if "bad" in url:
            raise ValueError("Failed to fetch https://bad.com/a")
        return ("Good", "good text")

    with patch("news_debias.fetch_article", side_effect=fake_fetch):
        results = fetch_all(["https://good.com/a", "https://bad.com/a"])
    assert len(results) == 1
    assert results[0][0] == "Good"
