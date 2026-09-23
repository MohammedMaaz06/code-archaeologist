import pytest
from app.services.graph_service import GraphService

def test_graph_service_build_and_traversal():
    graph_service = GraphService()

    symbols = [
        {
            "symbol_id": "auth.py:validate_user",
            "symbol_name": "validate_user",
            "symbol_type": "function",
            "file_path": "auth.py",
            "decorators": ["@app.get('/validate')"],
            "code": "def validate_user(): session.query(User).all()"
        },
        {
            "symbol_id": "main.py:login",
            "symbol_name": "login",
            "symbol_type": "function",
            "file_path": "main.py",
            "decorators": [],
            "code": "def login(): validate_user()"
        }
    ]

    resolved_calls = [
        {"caller_symbol_id": "main.py:login", "target_symbol_id": "auth.py:validate_user"}
    ]

    graph_service.build_graph_from_symbols(symbols, resolved_calls)

    # Verify callers & callees
    assert graph_service.get_callers("auth.py:validate_user") == ["main.py:login"]
    assert graph_service.get_callees("main.py:login") == ["auth.py:validate_user"]

    # Verify blast radius
    blast = graph_service.get_blast_radius("auth.py:validate_user")
    assert "main.py:login" in blast["affected_nodes"]
    assert blast["total_impacted"] == 1

    # Verify exported payload
    exported = graph_service.export_graph()
    assert len(exported["nodes"]) >= 2
    assert len(exported["edges"]) >= 1