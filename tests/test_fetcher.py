import pytest
from fetcher import extract_domain_label


def test_strips_www_prefix():
    assert extract_domain_label("https://www.bbc.co.uk/news/123") == "Bbc"


def test_no_www_prefix():
    assert extract_domain_label("https://reuters.com/article") == "Reuters"


def test_compound_subdomain():
    assert extract_domain_label("https://www.foxnews.com/story") == "Foxnews"


def test_capitalizes_result():
    assert extract_domain_label("https://apnews.com/article") == "Apnews"
