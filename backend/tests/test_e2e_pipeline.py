import pytest
import textwrap
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_archeology_e2e_pipeline(tmp_path):
    test_file = tmp_path / "auth.py"
    sample_code = textwrap.dedent("""
        def authenticate_user(token: str):
            return parse_jwt(token)

        def parse_jwt(raw_token: str):
            return {"user_id": 123}
    """).strip()
    test_file.write_text(sample_code, encoding="utf-8")

    # 1. Health check
    res_health = client.get("/api/v1/health")
    if res_health.status_code == 404:
        res_health = client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json().get("status") in ["ok", "healthy"]