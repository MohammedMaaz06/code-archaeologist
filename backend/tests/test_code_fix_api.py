import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from app.api.v1 import llm
from app.main import app


def test_code_fix_endpoint_returns_corrected_code(monkeypatch):
    def fake_generate_code_fix(
        source_code,
        issue,
        language="python",
        context=None,
    ):
        return {
            "status": "success",
            "corrected_code": "def add(a, b):\n    return a + b",
            "model": "test-model",
        }

    monkeypatch.setattr(
        llm.llm_service,
        "generate_code_fix",
        fake_generate_code_fix,
    )

    client = TestClient(app)

    response = client.post(
        "/api/v1/code-fix",
        json={
            "source_code": "def add(a, b):\n    return a - b",
            "issue": "The function should add the two values.",
            "language": "python",
        },
    )

    assert response.status_code == 200

    data = response.json()

    assert data["status"] == "success"
    assert data["language"] == "python"
    assert data["issue"] == "The function should add the two values."
    assert data["corrected_code"] == "def add(a, b):\n    return a + b"
    assert data["model"] == "test-model"

def test_code_fix_returns_impact_analysis_for_repository_file(monkeypatch):
    def fake_generate_code_fix(
        source_code,
        issue,
        language="python",
        context=None,
    ):
        return {
            "status": "success",
            "original_code": source_code,
            "corrected_code": "def add(a, b):\n    return a + b",
            "diff": "--- original\n+++ corrected\n",
            "changed": True,
            "model": "test-model",
            "validation_status": "passed",
            "validation_message": "Python syntax is valid.",
        }

    def fake_analyze_impact(target_file):
        return {
            "target_file": target_file,
            "direct_dependencies": ["utils.py"],
            "affected_files": ["main.py", "service.py"],
            "blast_radius_score": 2,
            "risk_level": "LOW",
        }

    monkeypatch.setattr(
        llm.llm_service,
        "generate_code_fix",
        fake_generate_code_fix,
    )
    monkeypatch.setattr(
        llm.archeology_engine,
        "analyze_impact",
        fake_analyze_impact,
    )

    client = TestClient(app)

    with tempfile.TemporaryDirectory() as tmpdir:
        repo = Path(tmpdir)

        (repo / "math.py").write_text(
            "def add(a, b):\n    return a - b\n",
            encoding="utf-8",
        )

        response = client.post(
            "/api/v1/code-fix",
            json={
                "repo_path": str(repo),
                "file_path": "math.py",
                "issue": "The function should add the values.",
            },
        )

    assert response.status_code == 200

    data = response.json()

    assert data["impact_analysis"]["target_file"] == "math.py"
    assert data["impact_analysis"]["affected_files"] == [
        "main.py",
        "service.py",
    ]
    assert data["impact_analysis"]["blast_radius_score"] == 2
    assert data["impact_analysis"]["risk_level"] == "LOW"
