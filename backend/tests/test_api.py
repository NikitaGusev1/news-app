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
