import os

from app.services.repository_analysis_service import RepositoryAnalysisService


def test_repository_analysis_builds_cross_file_call_graph(tmp_path):
    auth_file = tmp_path / "auth.py"
    service_file = tmp_path / "service.py"

    auth_file.write_text(
        "def authenticate_user():\n"
        "    return True\n",
        encoding="utf-8",
    )

    service_file.write_text(
        "from auth import authenticate_user\n\n"
        "def login_flow():\n"
        "    authenticate_user()\n",
        encoding="utf-8",
    )

    service = RepositoryAnalysisService(str(tmp_path))
    result = service.analyze()

    assert result["scanned_files"] == 2
    assert result["analyzed_files"] == 2
    assert result["symbols"] == 2
    assert result["calls"] == 1
    assert result["resolved_calls"] == 1

    graph = result["graph"]

    assert "auth.py:authenticate_user" in [
        node["id"] for node in graph["nodes"]
    ]

    assert "service.py:login_flow" in [
        node["id"] for node in graph["nodes"]
    ]

    assert any(
        edge["source"] == "service.py:login_flow"
        and edge["target"] == "auth.py:authenticate_user"
        and edge["relation"] == "CALLS"
        for edge in graph["edges"]
    )
