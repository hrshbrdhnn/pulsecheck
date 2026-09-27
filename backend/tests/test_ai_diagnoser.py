import pytest
from app.ai_diagnoser import generate_heuristic_fallback, generate_ai_diagnosis

def test_heuristic_fallback_502_bad_gateway():
    monitor = {"name": "Prod API", "type": "http", "url": "https://api.example.com"}
    heartbeat = {"status": 0, "msg": "HTTP 502 Bad Gateway", "ping": 120}
    res = generate_heuristic_fallback(monitor, heartbeat)

    assert "502 Bad Gateway" in res["summary"]
    assert res["severity"] == "CRITICAL"
    assert len(res["likely_causes"]) > 0
    assert len(res["recommended_actions"]) > 0

def test_heuristic_fallback_connection_refused():
    monitor = {"name": "Postgres DB", "type": "port", "url": "10.0.0.5", "port": 5432}
    heartbeat = {"status": 0, "msg": "Connection refused", "ping": 0}
    res = generate_heuristic_fallback(monitor, heartbeat)

    assert "Port Check Failed" in res["summary"]
    assert "5432" in res["summary"]
    assert any("5432" in cause for cause in res["likely_causes"])

def test_heuristic_fallback_keyword_missing():
    monitor = {"name": "Landing Page", "type": "keyword", "url": "https://example.com", "keyword": "Welcome"}
    heartbeat = {"status": 0, "msg": "Keyword 'Welcome' not found on page", "ping": 45}
    res = generate_heuristic_fallback(monitor, heartbeat)

    assert "Keyword Assertion Failed" in res["summary"]
    assert len(res["likely_causes"]) > 0

def test_ai_diagnosis_without_api_key():
    monitor = {"name": "Test Mon", "type": "http", "url": "https://example.com"}
    heartbeat = {"status": 0, "msg": "HTTP 500 Internal Server Error", "ping": 50}
    res = generate_ai_diagnosis(monitor, heartbeat, gemini_api_key="")

    assert "500 Internal Server Error" in res["summary"]
    assert res["severity"] == "CRITICAL"
