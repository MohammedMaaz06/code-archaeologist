from pathlib import Path

from app.analyzers.js_analyzer import JSTSAnalyzer


def test_javascript_ast_analysis_extracts_symbols_and_calls(tmp_path):
    file_path = tmp_path / "example.js"

    file_path.write_text(
        """
import { authenticate } from "./auth";

function login() {
    authenticate();
}

class UserService {
    getUser() {
        login();
    }
}
""",
        encoding="utf-8",
    )

    result = JSTSAnalyzer(file_path).analyze()

    assert result["language"] == "javascript"
    assert result["imports"][0]["module"] == "./auth"

    class_names = {
        item["symbol_name"]
        for item in result["classes"]
    }

    assert "UserService" in class_names

    function_names = {
        item["symbol_name"]
        for item in result["functions"]
    }

    assert "login" in function_names
    assert "getUser" in function_names

    calls = {
        (item["caller_symbol"], item["target_name"])
        for item in result["calls"]
    }

    assert ("login", "authenticate") in calls
    assert ("getUser", "login") in calls


def test_typescript_ast_analysis_extracts_function_and_call(tmp_path):
    file_path = tmp_path / "example.ts"

    file_path.write_text(
        """
interface User {
    id: number;
}

function getUser(id: number): User {
    return loadUser(id);
}
""",
        encoding="utf-8",
    )

    result = JSTSAnalyzer(file_path).analyze()

    assert result["language"] == "typescript"

    function_names = {
        item["symbol_name"]
        for item in result["functions"]
    }

    assert "getUser" in function_names

    calls = {
        (item["caller_symbol"], item["target_name"])
        for item in result["calls"]
    }

    assert ("getUser", "loadUser") in calls
