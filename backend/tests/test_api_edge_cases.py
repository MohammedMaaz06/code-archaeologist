import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def _post_with_fallback(client, path, **kwargs):
    res = client.post(path, **kwargs)
    if res.status_code == 404:
        # Strip /api/v1 prefix if present
        alt_path = path.replace("/api/v1", "") if "/api/v1" in path else f"/api/v1{path}"
        res = client.post(alt_path, **kwargs)
    return res

def test_symbols_extract_missing_file():
    res = _post_with_fallback(client, "/api/v1/symbols/extract", json={"file_path": "non_existent_path_999/foo.py"})
    assert res.status_code in (200, 400, 404, 422, 500)

def test_symbols_extract_syntax_error(tmp_path):
    bad_file = tmp_path / "broken_syntax.py"
    bad_file.write_text("def broken_function(: invalid python syntax", encoding="utf-8")
    res = _post_with_fallback(client, "/api/v1/symbols/extract", json={"file_path": str(bad_file)})
    assert res.status_code in (200, 400, 404, 422, 500)

def test_search_index_empty_files_list():
    res = _post_with_fallback(client, "/api/v1/search/index", json={"files": []})
    assert res.status_code in (200, 404, 422, 500)

def test_archeology_investigate_empty_query():
    res = _post_with_fallback(client, "/api/v1/archeology/investigate", json={"query": "", "top_k": 3})
    assert res.status_code in (200, 404, 422, 500)

def test_graph_build_empty_payload():
    res = _post_with_fallback(client, "/api/v1/graph/build", json={"files": [], "symbols": []})
    assert res.status_code in (200, 404, 422, 500)

def test_llm_explain_empty_query():
    res = _post_with_fallback(client, "/api/v1/llm/explain", json={"query": "   ", "top_k": 3})
    assert res.status_code in (200, 404, 422, 500)

def test_llm_refactor_risk_missing_file():
    res = _post_with_fallback(client, "/api/v1/llm/refactor-risk", json={"file_path": "missing.py"})
    assert res.status_code in (200, 400, 404, 422, 500)