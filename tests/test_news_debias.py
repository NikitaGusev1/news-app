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
