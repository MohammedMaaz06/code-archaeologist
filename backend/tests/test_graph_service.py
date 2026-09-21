import pytest
from app.services.graph_service import DependencyGraphService


def test_dependency_graph_building():
    svc = DependencyGraphService()
    svc.clear()

    svc.add_file_node("app/main.py", "python", 50)
    svc.add_file_node("app/config.py", "python", 20)

    svc.add_import_dependency("app/main.py", "app/config.py")
    svc.add_symbol_node("app/main.py::init_app", "init_app", "function", "app/main.py")

    metrics = svc.get_graph_metrics()
    assert metrics["total_nodes"] == 3  # app/main.py, app/config.py, symbol init_app
    assert metrics["total_edges"] == 2  # main -> config (IMPORTS), main -> init_app (CONTAINS)

    deps = svc.get_file_dependencies("app/main.py")
    assert "app/config.py" in deps["imports"]
