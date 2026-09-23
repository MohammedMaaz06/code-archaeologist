from fastapi import APIRouter
from typing import Dict, Any, List

router = APIRouter()

@router.get("/api/graph")
async def get_dependency_graph() -> Dict[str, List[Dict[str, Any]]]:
    """
    Returns nodes and edges for React Flow AST dependency visualization.
    """
    nodes = [
        {"id": "main", "data": {"label": "main.py (FastAPI App)"}, "position": {"x": 250, "y": 20}, "type": "input"},
        {"id": "ast_api", "data": {"label": "api_ast.py (/api/ast)"}, "position": {"x": 100, "y": 120}},
        {"id": "explain_api", "data": {"label": "api_explain.py (/api/explain)"}, "position": {"x": 400, "y": 120}},
        {"id": "ollama", "data": {"label": "Ollama Service (Local LLM)"}, "position": {"x": 400, "y": 240}, "type": "output"},
        {"id": "indexer", "data": {"label": "indexer.py (AST Extractor)"}, "position": {"x": 100, "y": 240}, "type": "output"},
    ]

    edges = [
        {"id": "e1-2", "source": "main", "target": "ast_api", "animated": True, "label": "includes"},
        {"id": "e1-3", "source": "main", "target": "explain_api", "animated": True, "label": "includes"},
        {"id": "e3-4", "source": "explain_api", "target": "ollama", "animated": True, "label": "httpx POST"},
        {"id": "e2-5", "source": "ast_api", "target": "indexer", "animated": True, "label": "imports"},
    ]

    return {"nodes": nodes, "edges": edges}
