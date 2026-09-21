from typing import Dict, List, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.graph_service import DependencyGraphService

router = APIRouter()
graph_service = DependencyGraphService()


class BuildGraphRequest(BaseModel):
    files: List[Dict[str, Any]]
    symbols: List[Dict[str, Any]]


class GraphMetricsResponse(BaseModel):
    total_nodes: int
    total_edges: int
    is_directed: bool
    top_depended_nodes: List[Dict[str, Any]]


class FileDependenciesResponse(BaseModel):
    file_path: str
    imports: List[str]
    imported_by: List[str]


@router.post("/build")
async def build_graph(request: BuildGraphRequest):
    try:
        graph_service.clear()

        # Add files
        for f in request.files:
            graph_service.add_file_node(
                relative_path=f["relative_path"],
                language=f.get("language", "unknown"),
                loc=f.get("loc", 0)
            )

        # Add symbols & edges
        for s in request.symbols:
            file_path = s["file_path"]
            symbol_id = f"{file_path}::{s['name']}"
            kind = s["kind"]

            if kind == "import":
                graph_service.add_import_dependency(file_path, s["name"])
            elif kind == "call":
                graph_service.add_call_dependency(file_path, s["name"])
            else:
                graph_service.add_symbol_node(symbol_id, s["name"], kind, file_path)

        return {"status": "success", "metrics": graph_service.get_graph_metrics()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build dependency graph: {str(e)}")


@router.get("/metrics", response_model=GraphMetricsResponse)
async def get_metrics():
    return graph_service.get_graph_metrics()


@router.get("/dependencies/{file_path:path}", response_model=FileDependenciesResponse)
async def get_dependencies(file_path: str):
    deps = graph_service.get_file_dependencies(file_path)
    return FileDependenciesResponse(
        file_path=file_path,
        imports=deps["imports"],
        imported_by=deps["imported_by"]
    )
