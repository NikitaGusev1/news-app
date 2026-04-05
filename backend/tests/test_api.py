import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

MOCK_SECTIONS = {
    "WHAT ALL SOURCES AGREE ON": "Agreed.",
    "HOW EACH SOURCE FRAMED IT": "Framing.",
    "LANGUAGE WORTH NOTICING": "Language.",
    "FACTS ONLY ONE SOURCE REPORTED": "Unique.",
}
MOCK_ANALYZE_RESULT = {"sections": MOCK_SECTIONS, "tokens_used": 300}


def test_analyze_success_returns_200():
    articles = [("BBC", "text a"), ("Reuters", "text b")]
    with patch("main.fetch_all", return_value=articles), \
         patch("main.analyze", return_value=MOCK_ANALYZE_RESULT):
        response = client.post("/analyze", json={"urls": ["https://bbc.com", "https://reuters.com"]})
    assert response.status_code == 200
    data = response.json()
    assert data["sections"] == MOCK_SECTIONS
    assert data["meta"]["sources_fetched"] == 2
    assert data["meta"]["sources_requested"] == 2
    assert data["meta"]["tokens_used"] == 300


def test_analyze_returns_400_when_fewer_than_2_sources_fetched():
    with patch("main.fetch_all", return_value=[("BBC", "text")]):
        response = client.post("/analyze", json={"urls": ["https://bbc.com", "https://bad.com"]})
    assert response.status_code == 400
    assert "2 sources" in response.json()["detail"]


def test_analyze_returns_422_for_missing_urls_field():
    response = client.post("/analyze", json={})
    assert response.status_code == 422


def test_analyze_meta_reflects_skipped_sources():
    articles = [("BBC", "text a"), ("Reuters", "text b")]
    with patch("main.fetch_all", return_value=articles), \
         patch("main.analyze", return_value=MOCK_ANALYZE_RESULT):
        response = client.post(
            "/analyze",
            json={"urls": ["https://bbc.com", "https://reuters.com", "https://bad.com"]},
        )
    assert response.status_code == 200
    data = response.json()
    assert data["meta"]["sources_fetched"] == 2
    assert data["meta"]["sources_requested"] == 3


def test_analyze_returns_500_on_unexpected_error():
    error_client = TestClient(app, raise_server_exceptions=False)
    articles = [("BBC", "text a"), ("Reuters", "text b")]
    with patch("main.fetch_all", return_value=articles), \
         patch("main.analyze", side_effect=Exception("unexpected")):
        response = error_client.post("/analyze", json={"urls": ["https://bbc.com", "https://reuters.com"]})
    assert response.status_code == 500


def test_search_returns_results():
    with patch("main.search_articles", return_value=[
        {"title": "Iran war", "url": "https://www.npr.org/2026/04/04/iran", "source": "NPR"}
    ]):
        response = client.get("/search?q=iran")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0] == {
        "title": "Iran war",
        "url": "https://www.npr.org/2026/04/04/iran",
        "source": "NPR",
    }


def test_search_blank_query_returns_empty_list():
    with patch("main.search_articles", return_value=[]):
        response = client.get("/search?q=")
    assert response.status_code == 200
    assert response.json() == []


def test_search_missing_q_param_returns_empty_list():
    with patch("main.search_articles", return_value=[]):
        response = client.get("/search")
    assert response.status_code == 200
    assert response.json() == []
