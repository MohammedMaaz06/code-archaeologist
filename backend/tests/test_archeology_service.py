import pytest
from app.services.graph_service import DependencyGraphService
from app.services.vector_service import VectorSearchService
from app.services.chunker_service import CodeChunker
from app.services.archeology_service import ArcheologyEngine


def test_archeology_engine_investigate():
    graph_svc = DependencyGraphService()
    vector_svc = VectorSearchService()

    graph_svc.add_file_node("app/auth.py", "python", 40)
    graph_svc.add_file_node("app/db.py", "python", 30)
    graph_svc.add_import_dependency("app/auth.py", "app/db.py")

    code = "def login_user(username, password):\n    return db.query(username)"
    chunks = CodeChunker.chunk_file(
        "app/auth.py",
        code,
        [{"name": "login_user", "kind": "function", "start_line": 1, "end_line": 2}],
        "python"
    )
    vector_svc.index_chunks(chunks)

    engine = ArcheologyEngine(graph_svc, vector_svc)
    res = engine.investigate("login user authentication")

    assert len(res["matched_chunks"]) > 0
    assert "app/auth.py" in res["relevant_files"]
    assert "app/db.py" in res["dependency_context"]["app/auth.py"]["imports"]


def test_archeology_impact_analysis():
    graph_svc = DependencyGraphService()
    graph_svc.add_file_node("app/utils.py", "python", 20)
    graph_svc.add_file_node("app/auth.py", "python", 40)
    graph_svc.add_file_node("app/api.py", "python", 50)

    graph_svc.add_import_dependency("app/auth.py", "app/utils.py")
    graph_svc.add_import_dependency("app/api.py", "app/utils.py")

    engine = ArcheologyEngine(graph_svc, VectorSearchService())
    impact = engine.analyze_impact("app/utils.py")

    assert impact["target_file"] == "app/utils.py"
    assert impact["blast_radius_score"] == 2
    assert "app/auth.py" in impact["affected_files"]
    assert "app/api.py" in impact["affected_files"]
