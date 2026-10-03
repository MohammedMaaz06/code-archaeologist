import hashlib
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


def test_apply_code_fix_updates_file_when_hash_matches():
    client = TestClient(app)

    with tempfile.TemporaryDirectory() as tmpdir:
        repo = Path(tmpdir)
        target = repo / "math.py"

        original = "def add(a, b):\n    return a - b\n"
        corrected = "def add(a, b):\n    return a + b\n"

        target.write_text(original, encoding="utf-8")

        expected_sha256 = hashlib.sha256(
            original.encode("utf-8")
        ).hexdigest()

        response = client.post(
            "/api/v1/apply-code-fix",
            json={
                "repo_path": str(repo),
                "file_path": "math.py",
                "expected_sha256": expected_sha256,
                "corrected_code": corrected,
            },
        )

        assert response.status_code == 200

        data = response.json()

        assert data["status"] == "applied"
        assert data["file_path"] == "math.py"
        assert data["previous_sha256"] == expected_sha256
        assert data["new_sha256"] == hashlib.sha256(
            corrected.encode("utf-8")
        ).hexdigest()
        assert target.read_text(encoding="utf-8") == corrected


def test_apply_code_fix_rejects_stale_file_and_preserves_contents():
    client = TestClient(app)

    with tempfile.TemporaryDirectory() as tmpdir:
        repo = Path(tmpdir)
        target = repo / "math.py"

        current = "def add(a, b):\n    return a * b\n"
        target.write_text(current, encoding="utf-8")

        response = client.post(
            "/api/v1/apply-code-fix",
            json={
                "repo_path": str(repo),
                "file_path": "math.py",
                "expected_sha256": "0" * 64,
                "corrected_code": "def add(a, b):\n    return a + b\n",
            },
        )

        assert response.status_code == 409

        data = response.json()["detail"]

        assert data["message"] == "File changed since the fix was generated."
        assert data["expected_sha256"] == "0" * 64
        assert data["current_sha256"] == hashlib.sha256(
            current.encode("utf-8")
        ).hexdigest()
        assert target.read_text(encoding="utf-8") == current


def test_apply_code_fix_blocks_path_traversal():
    client = TestClient(app)

    with tempfile.TemporaryDirectory() as tmpdir:
        repo = Path(tmpdir)
        outside = repo.parent / "outside.py"

        outside_original = "print('outside')\n"
        outside.write_text(outside_original, encoding="utf-8")

        response = client.post(
            "/api/v1/apply-code-fix",
            json={
                "repo_path": str(repo),
                "file_path": "../outside.py",
                "expected_sha256": "0" * 64,
                "corrected_code": "print('changed')\n",
            },
        )

        assert response.status_code == 400
        assert response.json()["detail"] == "file_path must point inside repo_path."
        assert outside.read_text(encoding="utf-8") == outside_original
