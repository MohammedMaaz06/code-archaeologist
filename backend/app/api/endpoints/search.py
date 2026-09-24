from fastapi import APIRouter, HTTPException, Status
from typing import List
from app.schemas.search import CodeSearchRequest, CodeSearchResponse, SearchResultItem, GraphNode, GraphEdge

router = APIRouter(prefix="/search", tags=["Code Search & Call Graph"])

@router.post("/", response_model=CodeSearchResponse, status_code=Status.HTTP_200_OK)
async def search_code_and_subgraph(payload: CodeSearchRequest):
    try:
        dummy_results = [
            SearchResultItem(
                symbol_id="app.services.parser.parse_ast",
                name="parse_ast",
                kind="function",
                file_path="backend/app/services/parser.py",
                score=0.92,
                snippet="def parse_ast(code: str) -> ASTNode: ..."
            )
        ]

        nodes: List[GraphNode] = []
        edges: List[GraphEdge] = []

        if payload.include_subgraph:
            nodes = [
                GraphNode(
                    id="app.services.parser.parse_ast",
                    name="parse_ast",
                    kind="function",
                    file_path="backend/app/services/parser.py",
                    line_number=14
                ),
                GraphNode(
                    id="app.services.resolver.resolve_symbols",
                    name="resolve_symbols",
                    kind="function",
                    file_path="backend/app/services/resolver.py",
                    line_number=42
                )
            ]
            edges = [
                GraphEdge(
                    source="app.services.parser.parse_ast",
                    target="app.services.resolver.resolve_symbols",
                    relationship="calls"
                )
            ]

        return CodeSearchResponse(
            query=payload.query,
            total_results=len(dummy_results),
            results=dummy_results,
            nodes=nodes,
            edges=edges
        )
    except Exception as e:
        raise HTTPException(
            status_code=Status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute code search and graph retrieval: {str(e)}"
        )
