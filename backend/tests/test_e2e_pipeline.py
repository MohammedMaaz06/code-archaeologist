import textwrap
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_full_archeology_e2e_pipeline(tmp_path):
    # Create physical temp file for AST extraction
    test_file = tmp_path / "auth.py"
    file_rel_path = "app/auth.py"
    sample_code = textwrap.dedent("""
        def authenticate_user(token: str):
            return parse_jwt(token)

        def parse_jwt(raw_token: str):
            return {"user_id": 123}
    """).strip()
    test_file.write_text(sample_code, encoding="utf-8")

    # 1. Health check
    res_health = client.get("/api/v1/health")
    assert res_health.status_code == 200
    assert res_health.json()["status"] == "healthy"

    # 2. Extract AST Symbols
    res_symbols = client.post(
        "/api/v1/symbols/extract",
        json={"file_path": str(test_file)}
    )
    assert res_symbols.status_code == 200, f"Symbol extraction failed: {res_symbols.text}"
    symbols_raw = res_symbols.json()
    assert isinstance(symbols_raw, list)
    assert len(symbols_raw) >= 2

    # Normalize file_path in extracted symbols to match repo relative paths
    symbols_list = []
    for sym in symbols_raw:
        sym_dict = dict(sym) if isinstance(sym, dict) else sym
        sym_dict["file_path"] = file_rel_path
        symbols_list.append(sym_dict)

    # 3. Build Graph
    res_graph = client.post(
        "/api/v1/graph/build",
        json={
            "files": [{"relative_path": file_rel_path, "language": "python", "loc": 10}],
            "symbols": symbols_list
        }
    )
    assert res_graph.status_code == 200, f"Graph build failed with 500: {res_graph.text}"
    assert res_graph.json()["status"] == "success"

    # 4. Index Vector Search Chunks
    res_index = client.post(
        "/api/v1/search/index",
        json={
            "files": [
                {
                    "file_path": file_rel_path,
                    "source_code": sample_code,
                    "language": "python",
                    "symbols": symbols_list
                }
            ]
        }
    )
    assert res_index.status_code == 200, f"Search index failed: {res_index.text}"
    assert res_index.json()["total_chunks_indexed"] >= 1

    # 5. Archeology Investigation Query
    res_investigate = client.post(
        "/api/v1/archeology/investigate",
        json={"query": "authenticate token user", "top_k": 3}
    )
    assert res_investigate.status_code == 200, f"Archeology investigation failed: {res_investigate.text}"
    inv_data = res_investigate.json()
    assert len(inv_data["matched_chunks"]) > 0

    # 6. LLM Explanation Synthesis
    res_explain = client.post(
        "/api/v1/llm/explain",
        json={"query": "authenticate token user", "top_k": 3}
    )
    assert res_explain.status_code == 200, f"LLM explain failed: {res_explain.text}"
    assert "explanation" in res_explain.json()

    # 7. LLM Refactoring Risk Assessment
    res_risk = client.post(
        "/api/v1/llm/refactor-risk",
        json={"target_file": file_rel_path}
    )
    assert res_risk.status_code == 200, f"LLM refactor risk failed: {res_risk.text}"
    assert "risk_report" in res_risk.json()
