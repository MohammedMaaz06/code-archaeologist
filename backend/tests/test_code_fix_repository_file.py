import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from app.api.v1 import llm
from app.main import app


def test_code_fix_reads_repository_file_and_blocks_path_traversal(monkeypatch):
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

    monkeypatch.setattr(
        llm.llm_service,
        "generate_code_fix",
        fake_generate_code_fix,
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

        assert data["file_path"] == "math.py"
        assert data["language"] == "python"
        assert data["original_code"] == "def add(a, b):\n    return a - b\n"
        assert data["status"] == "success"

        traversal = client.post(
            "/api/v1/code-fix",
            json={
                "repo_path": str(repo),
                "file_path": "../outside.py",
                "issue": "Test path traversal protection.",
            },
        )

        assert traversal.status_code == 400
        assert traversal.json()["detail"] == "file_path must point inside repo_path."
