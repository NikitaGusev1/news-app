from unittest.mock import patch, MagicMock

from searcher import search_articles, get_digest, _fetch_source, _group_articles


def _rss_xml(items):
    item_xml = "".join(
        f"<item><title>{t}</title><link>{u}</link></item>"
        for t, u in items
    )
    return f'<?xml version="1.0"?><rss version="2.0"><channel>{item_xml}</channel></rss>'


def _rdf_xml(items):
    ns = "http://purl.org/rss/1.0/"
    item_xml = "".join(
        f'<item xmlns="{ns}"><title>{t}</title><link>{u}</link></item>'
        for t, u in items
    )
    return (
        f'<?xml version="1.0"?>'
        f'<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" '
        f'xmlns="{ns}">{item_xml}</rdf:RDF>'
    )


def _mock_resp(xml_text):
    m = MagicMock()
    m.text = xml_text
    return m


@patch("searcher.httpx.get")
def test_fetch_source_rss(mock_get):
    mock_get.return_value = _mock_resp(_rss_xml([
        ("Ukraine war update", "https://www.npr.org/2026/04/06/ukraine"),
    ]))
    result = _fetch_source({"label": "NPR", "feed": "https://feeds.npr.org/1001/rss.xml", "ns": None})
    assert result == [{"title": "Ukraine war update", "url": "https://www.npr.org/2026/04/06/ukraine", "source": "NPR"}]


@patch("searcher.httpx.get")
def test_fetch_source_rdf_namespace(mock_get):
    mock_get.return_value = _mock_resp(_rdf_xml([
        ("Ukraine update", "https://www.dw.com/en/ukraine/a-12345"),
    ]))
    result = _fetch_source({"label": "DW", "feed": "https://rss.dw.com/rdf/rss-en-all", "ns": "http://purl.org/rss/1.0/"})
    assert result == [{"title": "Ukraine update", "url": "https://www.dw.com/en/ukraine/a-12345", "source": "DW"}]


@patch("searcher.httpx.get")
def test_fetch_source_network_error_returns_empty(mock_get):
    mock_get.side_effect = Exception("timeout")
    assert _fetch_source({"label": "NPR", "feed": "https://feeds.npr.org/1001/rss.xml", "ns": None}) == []


def _make_get_side_effect(npr_items=(), aj_items=(), dw_items=()):
    def side_effect(url, **kwargs):
        if "npr.org" in url:
            return _mock_resp(_rss_xml(npr_items))
        if "aljazeera.com" in url:
            return _mock_resp(_rss_xml(aj_items))
        if "dw.com" in url:
            return _mock_resp(_rdf_xml(dw_items))
        raise Exception(f"unexpected URL: {url}")
    return side_effect


@patch("searcher.httpx.get")
def test_returns_matching_results_from_multiple_sources(mock_get):
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[("Iran war enters week 6", "https://www.npr.org/iran-war")],
        aj_items=[("Iran: civilians at risk", "https://www.aljazeera.com/iran")],
    )
    results = search_articles("iran")
    assert len(results) == 2
    assert results[0] == {"title": "Iran war enters week 6", "url": "https://www.npr.org/iran-war", "source": "NPR"}
    assert results[1] == {"title": "Iran: civilians at risk", "url": "https://www.aljazeera.com/iran", "source": "Al Jazeera"}


@patch("searcher.httpx.get")
def test_filters_out_non_matching_titles(mock_get):
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[
            ("Iran war update", "https://www.npr.org/iran"),
            ("Climate summit opens", "https://www.npr.org/climate"),
        ],
    )
    results = search_articles("iran")
    assert len(results) == 1
    assert results[0]["title"] == "Iran war update"


@patch("searcher.httpx.get")
def test_multi_word_query_requires_all_terms(mock_get):
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[
            ("Iran war enters week 6", "https://www.npr.org/iran-war"),
            ("Iran diplomacy talks", "https://www.npr.org/iran-diplomacy"),
        ],
    )
    results = search_articles("iran war")
    assert len(results) == 1
    assert results[0]["title"] == "Iran war enters week 6"


def test_blank_query_returns_empty_without_http():
    with patch("searcher.httpx.get") as mock_get:
        assert search_articles("") == []
        assert search_articles("   ") == []
        mock_get.assert_not_called()


@patch("searcher.httpx.get")
def test_all_sources_fail_returns_empty(mock_get):
    mock_get.side_effect = Exception("connection refused")
    assert search_articles("iran") == []


@patch("searcher.httpx.get")
def test_failed_source_does_not_affect_others(mock_get):
    def side_effect(url, **kwargs):
        if "npr.org" in url:
            return _mock_resp(_rss_xml([("iran war", "https://www.npr.org/iran")]))
        raise Exception("timeout")
    mock_get.side_effect = side_effect
    results = search_articles("iran")
    assert len(results) == 1
    assert results[0]["source"] == "NPR"


@patch("searcher.httpx.get")
def test_results_capped_at_10(mock_get):
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[(f"ukraine news {i}", f"https://www.npr.org/{i}") for i in range(15)],
    )
    results = search_articles("ukraine")
    assert len(results) == 10


@patch("searcher.fetch_article", return_value=("source", "article text"))
@patch("searcher.httpx.get")
def test_get_digest_returns_grouped_stories_from_feeds(mock_get, mock_fetch_article):
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[
            ("Iran war enters week six", "https://www.npr.org/iran"),
            ("Climate summit opens today", "https://www.npr.org/climate"),
        ],
        aj_items=[
            ("Iran war civilians flee", "https://www.aljazeera.com/iran"),
        ],
        dw_items=[
            ("Climate summit begins now", "https://www.dw.com/climate"),
        ],
    )
    result = get_digest()
    assert len(result) == 2
    assert result[0]["title"] == "Iran war enters week six"
    assert set(result[0]["sources"]) == {"NPR", "Al Jazeera"}
    assert set(result[0]["urls"]) == {
        "https://www.npr.org/iran",
        "https://www.aljazeera.com/iran",
    }
    assert result[1]["title"] == "Climate summit opens today"
    assert set(result[1]["sources"]) == {"NPR", "DW"}
    assert set(result[1]["urls"]) == {
        "https://www.npr.org/climate",
        "https://www.dw.com/climate",
    }
    assert mock_fetch_article.call_count == 4


@patch("searcher.fetch_article", return_value=("source", "article text"))
@patch("searcher.httpx.get")
def test_get_digest_caps_results_at_5_groups(mock_get, mock_fetch_article):
    topics = [
        "alpha economy",
        "bravo markets",
        "charlie politics",
        "delta climate",
        "echo health",
        "foxtrot science",
    ]
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[
            (f"{topic} update", f"https://www.npr.org/{topic.replace(' ', '-')}")
            for topic in topics
        ],
        aj_items=[
            (f"{topic} report", f"https://www.aljazeera.com/{topic.replace(' ', '-')}")
            for topic in topics
        ],
    )
    result = get_digest()
    assert len(result) == 5
    assert [group["title"] for group in result] == [
        "alpha economy update",
        "bravo markets update",
        "charlie politics update",
        "delta climate update",
        "echo health update",
    ]
    assert mock_fetch_article.call_count == 10


@patch("searcher.fetch_article")
@patch("searcher.httpx.get")
def test_get_digest_excludes_groups_below_two_fetchable_urls(mock_get, mock_fetch_article):
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[("Iran war update", "https://www.npr.org/iran")],
        aj_items=[("Iran war report", "https://www.aljazeera.com/iran")],
    )
    mock_fetch_article.side_effect = [
        ("NPR", "article text"),
        ValueError("failed extraction"),
    ]

    assert get_digest() == []


@patch("searcher.fetch_article")
@patch("searcher.httpx.get")
def test_get_digest_keeps_source_url_alignment_after_partial_failure(mock_get, mock_fetch_article):
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[("Climate summit opens today", "https://www.npr.org/climate")],
        aj_items=[("Climate summit report today", "https://www.aljazeera.com/climate")],
        dw_items=[("Climate summit begins today", "https://www.dw.com/climate")],
    )

    def extract(url):
        if "aljazeera.com" in url:
            raise ValueError("failed extraction")
        return ("source", "article text")

    mock_fetch_article.side_effect = extract

    assert get_digest() == [{
        "title": "Climate summit opens today",
        "sources": ["NPR", "DW"],
        "urls": ["https://www.npr.org/climate", "https://www.dw.com/climate"],
    }]


@patch("searcher.fetch_article")
@patch("searcher.httpx.get")
def test_get_digest_isolates_article_failure_from_other_groups(mock_get, mock_fetch_article):
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[
            ("Iran war update", "https://www.npr.org/iran"),
            ("Climate summit opens", "https://www.npr.org/climate"),
        ],
        aj_items=[
            ("Iran war report", "https://www.aljazeera.com/iran"),
            ("Climate summit begins", "https://www.aljazeera.com/climate"),
        ],
    )

    def extract(url):
        if url == "https://www.aljazeera.com/iran":
            raise RuntimeError("unexpected extractor failure")
        return ("source", "article text")

    mock_fetch_article.side_effect = extract

    assert get_digest() == [{
        "title": "Climate summit opens",
        "sources": ["NPR", "Al Jazeera"],
        "urls": ["https://www.npr.org/climate", "https://www.aljazeera.com/climate"],
    }]


@patch("searcher.fetch_article", side_effect=ValueError("unavailable"))
@patch("searcher.httpx.get")
def test_get_digest_broad_extraction_failure_returns_empty(mock_get, mock_fetch_article):
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[("Iran war update", "https://www.npr.org/iran")],
        aj_items=[("Iran war report", "https://www.aljazeera.com/iran")],
    )

    assert get_digest() == []
    assert mock_fetch_article.call_count == 2


@patch("searcher.fetch_article", return_value=("source", "article text"))
@patch("searcher.httpx.get")
def test_get_digest_isolates_feed_failure(mock_get, mock_fetch_article):
    def get_feed(url, **kwargs):
        if "npr.org" in url:
            raise RuntimeError("feed unavailable")
        if "aljazeera.com" in url:
            return _mock_resp(_rss_xml([
                ("Climate summit report", "https://www.aljazeera.com/climate"),
            ]))
        return _mock_resp(_rdf_xml([
            ("Climate summit update", "https://www.dw.com/climate"),
        ]))

    mock_get.side_effect = get_feed

    assert get_digest() == [{
        "title": "Climate summit report",
        "sources": ["Al Jazeera", "DW"],
        "urls": ["https://www.aljazeera.com/climate", "https://www.dw.com/climate"],
    }]
    assert mock_fetch_article.call_count == 2


@patch("searcher.fetch_article")
@patch("searcher.httpx.get", side_effect=RuntimeError("all feeds unavailable"))
def test_get_digest_broad_feed_failure_returns_empty(mock_get, mock_fetch_article):
    assert get_digest() == []
    assert mock_get.call_count == 3
    mock_fetch_article.assert_not_called()


@patch("searcher.fetch_article")
@patch("searcher.httpx.get")
def test_get_digest_cap_applies_after_fetchability_filtering(mock_get, mock_fetch_article):
    topics = [
        "alpha economy",
        "bravo markets",
        "charlie politics",
        "delta climate",
        "echo health",
        "foxtrot science",
    ]
    mock_get.side_effect = _make_get_side_effect(
        npr_items=[
            (f"{topic} update", f"https://www.npr.org/{index}")
            for index, topic in enumerate(topics)
        ],
        aj_items=[
            (f"{topic} report", f"https://www.aljazeera.com/{index}")
            for index, topic in enumerate(topics)
        ],
    )

    def extract(url):
        if url.endswith("/0"):
            raise ValueError("first group is not fetchable")
        return ("source", "article text")

    mock_fetch_article.side_effect = extract

    result = get_digest()

    assert len(result) == 5
    assert [group["title"] for group in result] == [
        "bravo markets update",
        "charlie politics update",
        "delta climate update",
        "echo health update",
        "foxtrot science update",
    ]


def test_group_articles_groups_by_shared_significant_words():
    items = [
        {"title": "Iran war enters week six", "url": "https://www.npr.org/iran", "source": "NPR"},
        {"title": "Iran war civilians flee", "url": "https://www.aljazeera.com/iran", "source": "Al Jazeera"},
    ]
    result = _group_articles(items)
    assert len(result) == 1
    assert result[0]["title"] == "Iran war enters week six"
    assert set(result[0]["sources"]) == {"NPR", "Al Jazeera"}
    assert set(result[0]["urls"]) == {
        "https://www.npr.org/iran",
        "https://www.aljazeera.com/iran",
    }


def test_group_articles_excludes_single_source_groups():
    items = [
        {"title": "Iran update", "url": "https://www.npr.org/iran", "source": "NPR"},
        {"title": "Climate summit", "url": "https://www.aljazeera.com/climate", "source": "Al Jazeera"},
    ]
    result = _group_articles(items)
    assert result == []


def test_group_articles_ignores_stopwords_for_overlap():
    items = [
        {"title": "the Iran update", "url": "https://www.npr.org/iran", "source": "NPR"},
        {"title": "a Iran report", "url": "https://www.aljazeera.com/iran", "source": "Al Jazeera"},
    ]
    result = _group_articles(items)
    assert result == []


def test_group_articles_sorts_by_source_count_descending():
    items = [
        {"title": "Iran war update", "url": "https://www.npr.org/iran", "source": "NPR"},
        {"title": "Iran war report", "url": "https://www.aljazeera.com/iran", "source": "Al Jazeera"},
        {"title": "Climate summit opens today", "url": "https://www.dw.com/climate", "source": "DW"},
        {"title": "Climate summit begins now", "url": "https://www.npr.org/climate", "source": "NPR"},
        {"title": "Climate summit underway", "url": "https://www.aljazeera.com/climate", "source": "Al Jazeera"},
    ]
    result = _group_articles(items)
    assert len(result) == 2
    assert len(result[0]["sources"]) == 3
    assert len(result[1]["sources"]) == 2
