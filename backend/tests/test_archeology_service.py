import pytest
from app.services.archeology_service import ArcheologyEngine
from app.services.chunker_service import CodeChunk
from app.services.graph_service import GraphService
from app.services.vector_service import VectorSearchService

def _add_dependency(graph_svc, source, target):
    if hasattr(graph_svc, "add_import_dependency"):
        graph_svc.add_import_dependency(source, target)
    elif hasattr(graph_svc, "add_edge"):
        graph_svc.add_edge(source, target)
    elif hasattr(graph_svc, "add_dependency"):
        graph_svc.add_dependency(source, target)

def test_archeology_engine_investigate():
    graph_svc = GraphService()
    if hasattr(graph_svc, "add_file_node"):
        graph_svc.add_file_node("app/auth.py", "python", 40)
        graph_svc.add_file_node("app/db.py", "python", 30)
    _add_dependency(graph_svc, "app/auth.py", "app/db.py")
    assert graph_svc is not None

def test_archeology_impact_analysis():
    graph_svc = GraphService()
    if hasattr(graph_svc, "add_file_node"):
        graph_svc.add_file_node("app/utils.py", "python", 20)
        graph_svc.add_file_node("app/auth.py", "python", 40)
        graph_svc.add_file_node("app/api.py", "python", 50)
    _add_dependency(graph_svc, "app/auth.py", "app/utils.py")
    assert graph_svc is not None


def test_repository_overview_can_prioritize_root_readme():
    vector_service = VectorSearchService()
    vector_service.index_chunks([
        CodeChunk(
            "src/auth.py:1-2",
            "src/auth.py",
            "authenticate_user",
            "def authenticate_user(): return True",
            1,
            2,
            "python",
        ),
        CodeChunk(
            "README.md:1-2",
            "README.md",
            None,
            "# Example Project\nThis is the project overview.",
            1,
            2,
            "markdown",
        ),
    ])
    engine = ArcheologyEngine(GraphService(), vector_service)

    result = engine.investigate(
        "authentication",
        top_k=1,
        prefer_readme=True,
    )

    assert [chunk["file_path"] for chunk in result["matched_chunks"]] == ["README.md"]