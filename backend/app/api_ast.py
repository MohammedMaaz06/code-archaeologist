from fastapi import APIRouter, Query
from typing import List, Optional, Dict, Any

router = APIRouter()

@router.get("/api/ast")
async def get_ast_symbols(repo_path: Optional[str] = Query(None, description="Path to indexed repository")) -> Dict[str, Any]:
    """
    Returns indexed AST nodes and symbol hierarchy for the repository.
    """
    # Sample AST symbol response structure from indexed files
    mock_ast_tree = [
        {
            "id": "backend/app/main.py::app",
            "name": "app",
            "kind": "variable",
            "filePath": "backend/app/main.py",
            "lineStart": 12,
            "lineEnd": 12,
            "signature": "app = FastAPI(title='Code Archaeologist API')",
            "docstring": "FastAPI application instance for repository indexation & semantic code search."
        },
        {
            "id": "backend/app/main.py::index_repository",
            "name": "index_repository",
            "kind": "function",
            "filePath": "backend/app/main.py",
            "lineStart": 45,
            "lineEnd": 88,
            "signature": "async def index_repository(repo_url: str, bg_tasks: BackgroundTasks) -> Dict[str, str]",
            "docstring": "Triggers repository clone, AST parsing, vector embedding, and Graph DB ingestion.",
            "children": [
                {
                    "id": "backend/app/main.py::index_repository::parse_ast_tree",
                    "name": "parse_ast_tree",
                    "kind": "function",
                    "filePath": "backend/app/main.py",
                    "lineStart": 52,
                    "lineEnd": 64,
                    "signature": "def parse_ast_tree(file_content: str) -> List[Dict[str, Any]]",
                    "docstring": "Uses Python ast module / tree-sitter to build symbol hierarchy."
                }
            ]
        },
        {
            "id": "backend/app/services/indexer.py::CodeIndexer",
            "name": "CodeIndexer",
            "kind": "class",
            "filePath": "backend/app/services/indexer.py",
            "lineStart": 10,
            "lineEnd": 120,
            "signature": "class CodeIndexer(BaseIndexer)",
            "docstring": "Core service for parsing source code into AST hierarchies and generating vector embeddings.",
            "children": [
                {
                    "id": "backend/app/services/indexer.py::CodeIndexer::__init__",
                    "name": "__init__",
                    "kind": "method",
                    "filePath": "backend/app/services/indexer.py",
                    "lineStart": 14,
                    "lineEnd": 22,
                    "signature": "def __init__(self, db_session, vector_store) -> None"
                },
                {
                    "id": "backend/app/services/indexer.py::CodeIndexer::extract_symbols",
                    "name": "extract_symbols",
                    "kind": "method",
                    "filePath": "backend/app/services/indexer.py",
                    "lineStart": 24,
                    "lineEnd": 68,
                    "signature": "async def extract_symbols(self, file_path: str) -> List[ASTNode]",
                    "docstring": "Walks AST tree nodes to capture classes, methods, functions, and import dependencies."
                }
            ]
        }
    ]

    return {
        "status": "success",
        "total_symbols": len(mock_ast_tree),
        "symbols": mock_ast_tree
    }
