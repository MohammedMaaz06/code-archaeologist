import tempfile
from pathlib import Path

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_scan_repository_populates_dependency_graph(async_client: AsyncClient):
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)

        (tmp_path / "auth.py").write_text(
            "def authenticate_user():\n"
            "    return True\n",
            encoding="utf-8",
        )

        (tmp_path / "main.py").write_text(
            "from auth import authenticate_user\n\n"
            "def login():\n"
            "    return authenticate_user()\n",
            encoding="utf-8",
        )

        response = await async_client.post(
            "/api/v1/scan",
            json={"path": tmpdir},
        )

        assert response.status_code == 200

        repository = response.json()
        assert repository["total_files"] == 2

        graph_response = await async_client.get("/api/v1/graph/export")

        assert graph_response.status_code == 200

        graph = graph_response.json()

        node_ids = {node["id"] for node in graph["nodes"]}

        assert "auth.py:authenticate_user" in node_ids
        assert "main.py:login" in node_ids

        assert any(
            edge["source"] == "main.py"
            and edge["target"] == "auth.py"
            and edge["relation"] == "IMPORTS"
            for edge in graph["edges"]
        )

        assert any(
            edge["source"] == "main.py:login"
            and edge["target"] == "auth.py:authenticate_user"
            and edge["relation"] == "CALLS"
            for edge in graph["edges"]
        )
