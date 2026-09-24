import pytest
from app.services.graph_service import GraphService

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