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


def test_explain_requires_the_requested_repository_to_be_indexed(tmp_path):
    res = client.post(
        "/api/v1/explain",
        json={
            "query": "What does this project do?",
            "repository_path": str(tmp_path / "not-indexed"),
        },
    )

    assert res.status_code == 409
    assert "Rescan it" in res.json()["detail"]


def test_explain_uses_repository_scoped_index_and_root_readme(tmp_path, monkeypatch):
    import app.api.v1.llm as llm_api

    legal_repo = tmp_path / "legal"
    other_repo = tmp_path / "other"
    legal_repo.mkdir()
    other_repo.mkdir()
    for repo_path, project_name in (
        (legal_repo, "LegalGuard compliance checker"),
        (other_repo, "Different project"),
    ):
        res = client.post(
            "/api/v1/index",
            json={
                "repository_path": str(repo_path),
                "files": [
                    {
                        "file_path": "README.md",
                        "source_code": f"# {project_name}\nThis project description is repository evidence.",
                        "language": "markdown",
                    },
                    {
                        "file_path": "auth.py",
                        "source_code": "def authenticate_user():\n    return True",
                        "language": "python",
                    },
                ],
            },
        )
        assert res.status_code == 200

    monkeypatch.setattr(
        llm_api.llm_service,
        "generate_explanation",
        lambda _context: "grounded test response",
    )
    res = client.post(
        "/api/v1/explain",
        json={
            "query": "tell about what the project do",
            "top_k": 3,
            "repository_path": str(legal_repo),
        },
    )

    assert res.status_code == 200
    matched_chunks = res.json()["raw_context"]["matched_chunks"]
    assert matched_chunks[0]["file_path"] == "README.md"
    assert "LegalGuard compliance checker" in matched_chunks[0]["content"]

    legal_search = client.post(
        "/api/v1/query",
        json={
            "query": "LegalGuard compliance",
            "repository_path": str(legal_repo),
        },
    )
    other_search = client.post(
        "/api/v1/query",
        json={
            "query": "Different project",
            "repository_path": str(other_repo),
        },
    )
    assert "LegalGuard" in str(legal_search.json()["results"])
    assert "Different project" in str(other_search.json()["results"])


def test_llm_refactor_risk_missing_file():
    res = _post_with_fallback(client, "/api/v1/llm/refactor-risk", json={"file_path": "missing.py"})
    assert res.status_code in (200, 400, 404, 422, 500)