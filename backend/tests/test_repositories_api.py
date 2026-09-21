import tempfile
from pathlib import Path
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_scan_repository_endpoint(async_client: AsyncClient):
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        test_file = tmp_path / "app.py"
        test_file.write_text("def hello():\n    return 'world'\n", encoding="utf-8")

        response = await async_client.post(
            "/api/v1/repositories/scan",
            json={"path": tmpdir},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_files"] == 1
        assert data["total_loc"] == 2
        assert len(data["files"]) == 1
        assert data["files"][0]["relative_path"] == "app.py"
        assert data["files"][0]["language"] == "python"
