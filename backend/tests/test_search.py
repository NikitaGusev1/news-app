from unittest.mock import patch, MagicMock

from searcher import search_articles, _fetch_source


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
