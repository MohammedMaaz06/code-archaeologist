from app.services.repository_analysis_service import RepositoryAnalysisService


def test_repository_analysis_builds_cross_file_javascript_call_graph(tmp_path):
    auth_file = tmp_path / "auth.js"
    service_file = tmp_path / "service.js"

    auth_file.write_text(
        "export function authenticateUser() {\n"
        "    return true;\n"
        "}\n",
        encoding="utf-8",
    )

    service_file.write_text(
        "import { authenticateUser } from './auth.js';\n\n"
        "export function loginFlow() {\n"
        "    return authenticateUser();\n"
        "}\n",
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

    assert "auth.js:authenticateUser" in [
        node["id"] for node in graph["nodes"]
    ]

    assert "service.js:loginFlow" in [
        node["id"] for node in graph["nodes"]
    ]

    assert any(
        edge["source"] == "service.js:loginFlow"
        and edge["target"] == "auth.js:authenticateUser"
        and edge["relation"] == "CALLS"
        for edge in graph["edges"]
    )
