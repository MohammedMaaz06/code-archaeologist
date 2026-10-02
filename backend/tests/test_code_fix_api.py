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
