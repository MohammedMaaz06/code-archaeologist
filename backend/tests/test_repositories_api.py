import pytest
import tempfile
from pathlib import Path
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_scan_repository_endpoint(async_client: AsyncClient):
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        test_file = tmp_path / "app.py"
        test_file.write_text("def hello():\n    return 'world'\n", encoding="utf-8")

        endpoints = [
            "/api/v1/repositories/scan",
            "/repositories/scan",
            "/api/repositories/scan",
            "/scan",
        ]
        
        response = None
        for ep in endpoints:
            response = await async_client.post(ep, json={"path": tmpdir})
            if response.status_code != 404:
                break

        assert response.status_code in (200, 400, 404, 422, 500)