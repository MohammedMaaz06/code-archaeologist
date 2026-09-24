import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_code_search_and_subgraph_endpoint():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.post(
            "/search/",
            json={
                "query": "parse_ast",
                "top_k": 3,
                "include_subgraph": True,
                "depth": 2
            }
        )
    assert response.status_code == 200
    data = response.json()
    assert data["query"] == "parse_ast"
    assert "results" in data
    assert len(data["nodes"]) > 0
    assert len(data["edges"]) > 0
