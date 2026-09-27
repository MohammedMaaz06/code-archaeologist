from app.services.repository_analysis_service import RepositoryAnalysisService


def test_repository_analysis_builds_python_import_graph(tmp_path):
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
        "    return authenticate_user()\n",
        encoding="utf-8",
    )

    service = RepositoryAnalysisService(str(tmp_path))
    result = service.analyze()

    graph = result["graph"]

    assert any(
        edge["source"] == "service.py"
        and edge["target"] == "auth.py"
        and edge["relation"] == "IMPORTS"
        for edge in graph["edges"]
    )


def test_repository_analysis_builds_javascript_import_graph(tmp_path):
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

    graph = result["graph"]

    assert any(
        edge["source"] == "service.js"
        and edge["target"] == "auth.js"
        and edge["relation"] == "IMPORTS"
        for edge in graph["edges"]
    )
