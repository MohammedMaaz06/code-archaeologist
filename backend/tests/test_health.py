import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_health_endpoint(async_client: AsyncClient):
    response = await async_client.get("/api/v1/health")
    if response.status_code == 404:
        response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") in ["ok", "healthy"]

@pytest.mark.asyncio
async def test_root_endpoint(async_client: AsyncClient):
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data or "status" in data