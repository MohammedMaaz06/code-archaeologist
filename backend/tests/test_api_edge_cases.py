import pytest
import textwrap
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_symbols_extract_missing_file():
    """Requesting symbol extraction on a non-existent file path should return 400 Bad Request."""
    res = client.post(
        "/api/v1/symbols/extract",
        json={"file_path": "non_existent_path_999/foo.py"}
    )
    assert res.status_code == 400
    assert "not found" in res.json().get("detail", "").lower()


def test_symbols_extract_syntax_error(tmp_path):
    """Parsing code with invalid Python syntax should handle errors gracefully."""
    bad_file = tmp_path / "broken_syntax.py"
    bad_file.write_text("def broken_function(: invalid python syntax", encoding="utf-8")

    res = client.post(
        "/api/v1/symbols/extract",
        json={"file_path": str(bad_file)}
    )
    # Returns 200 with empty list or 400 with syntax detail depending on parser setup
    assert res.status_code in (200, 400)
    if res.status_code == 200:
        assert isinstance(res.json(), list)


def test_search_index_empty_files_list():
    """Indexing an empty file list should succeed without error."""
    res = client.post(
        "/api/v1/search/index",
        json={"files": []}
    )
    assert res.status_code == 200
    data = res.json()
    assert data.get("total_chunks_indexed", 0) == 0


def test_archeology_investigate_empty_query():
    """Querying with an empty search string should return a valid response with empty results."""
    res = client.post(
        "/api/v1/archeology/investigate",
        json={"query": "", "top_k": 3}
    )
    assert res.status_code == 200
    assert "matched_chunks" in res.json()


def test_graph_build_empty_payload():
    """Building a knowledge graph with empty files and symbols should complete gracefully."""
    res = client.post(
        "/api/v1/graph/build",
        json={"files": [], "symbols": []}
    )
    assert res.status_code == 200
    assert res.json().get("status") == "success"


def test_llm_explain_empty_query():
    """Passing an empty prompt query to LLM explanation service should handle cleanly."""
    res = client.post(
        "/api/v1/llm/explain",
        json={"query": "   ", "top_k": 3}
    )
    assert res.status_code == 200
    assert "explanation" in res.json()


def test_llm_refactor_risk_missing_file():
    """Assessing refactoring risk on a file that wasn't indexed or scanned."""
    res = client.post(
        "/api/v1/llm/refactor-risk",
        json={"target_file": "missing/non_existent.py"}
    )
    assert res.status_code in (200, 400, 404)
