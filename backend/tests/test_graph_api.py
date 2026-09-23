import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.api.v1.graph import graph_service

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_mock_graph():
    symbols = [
        {
            "symbol_id": "service.py:process",
            "symbol_name": "process",
            "symbol_type": "function",
            "file_path": "service.py"
        },
        {
            "symbol_id": "api.py:handler",
            "symbol_name": "handler",
            "symbol_type": "function",
            "file_path": "api.py"
        }
    ]
    calls = [
        {"caller_symbol_id": "api.py:handler", "target_symbol_id": "service.py:process"}
    ]
    graph_service.build_graph_from_symbols(symbols, calls)

def test_graph_export_endpoint():
    response = client.get("/api/v1/graph/export")
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data

def test_blast_radius_endpoint():
    response = client.get("/api/v1/graph/blast-radius?symbol_id=service.py:process&max_depth=3")
    assert response.status_code == 200
    data = response.json()
    assert data["symbol_id"] == "service.py:process"
    assert "api.py:handler" in data["affected_nodes"]
    assert data["total_impacted"] == 1