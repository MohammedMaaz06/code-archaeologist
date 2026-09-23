import pytest
import os
import tempfile
from app.services.repo_scanner import RepoScanner
from app.analyzers.python_analyzer import PythonAnalyzer
from app.services.symbol_resolver import SymbolResolver
from app.services.graph_service import GraphService

def test_full_archeology_e2e_pipeline():
    with tempfile.TemporaryDirectory() as tmp_dir:
        # Create dummy module files
        auth_file = os.path.join(tmp_dir, "auth.py")
        service_file = os.path.join(tmp_dir, "service.py")

        with open(auth_file, "w") as f:
            f.write("def authenticate_user():\n    return True\n")

        with open(service_file, "w") as f:
            f.write("from auth import authenticate_user\n\ndef login_flow():\n    authenticate_user()\n")

        # 1. Scan Repository
        scanner = RepoScanner()
        scanned_files = scanner.scan_directory(tmp_dir)
        assert len(scanned_files) == 2

        # 2. Extract AST Symbols
        analyzer = PythonAnalyzer()
        parsed_data = []
        for file_info in scanned_files:
            file_path = file_info["path"]
            with open(file_path, "r") as f:
                code = f.read()
            analysis = analyzer.analyze(code, file_path)
            parsed_data.append(analysis)

        # 3. Resolve Symbols
        resolver = SymbolResolver()
        resolver.register_symbols(parsed_data)

        # Resolve function call inside service.py
        resolved_call = resolver.resolve_call(service_file, "login_flow", "authenticate_user")
        assert resolved_call["resolved"] is True
        assert resolved_call["resolution_type"] == "imported"

        # 4. Build Knowledge Graph & Test Traversal
        graph_service = GraphService()
        all_symbols = []
        for file_data in parsed_data:
            all_symbols.extend(file_data.get("functions", []))

        resolved_calls = [
            {
                "caller_symbol_id": f"{service_file}:login_flow",
                "target_symbol_id": resolved_call["target_symbol_id"]
            }
        ]

        graph_service.build_graph_from_symbols(all_symbols, resolved_calls)

        # 5. Blast Radius Check
        impact = graph_service.get_blast_radius(f"{auth_file}:authenticate_user")
        assert f"{service_file}:login_flow" in impact["affected_nodes"]
        assert impact["total_impacted"] == 1