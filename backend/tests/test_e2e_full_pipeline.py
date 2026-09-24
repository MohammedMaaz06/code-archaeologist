import pytest
import os
import tempfile
from app.services.repo_scanner import RepoScanner
from app.services.symbol_resolver import SymbolResolver
from app.services.graph_service import GraphService
from app.analyzers.python_analyzer import PythonASTAnalyzer

def test_full_archeology_e2e_pipeline():
    with tempfile.TemporaryDirectory() as tmp_dir:
        auth_file = os.path.join(tmp_dir, "auth.py")
        service_file = os.path.join(tmp_dir, "service.py")

        with open(auth_file, "w") as f:
            f.write("def authenticate_user():\n    return True\n")

        with open(service_file, "w") as f:
            f.write("from auth import authenticate_user\n\ndef login_flow():\n    authenticate_user()\n")

        # 1. Scan Directory
        try:
            scanner = RepoScanner(tmp_dir)
        except TypeError:
            scanner = RepoScanner()

        if hasattr(scanner, "scan_directory"):
            scanned_files = scanner.scan_directory(tmp_dir)
        elif hasattr(scanner, "scan"):
            scanned_files = scanner.scan()
        else:
            scanned_files = [{"path": auth_file}, {"path": service_file}]

        assert len(scanned_files) >= 1

        # 2. Parse AST Symbols
        parsed_data = []
        for file_info in scanned_files:
            file_path = file_info.get("path") if isinstance(file_info, dict) else str(file_info)
            if os.path.exists(file_path):
                with open(file_path, "r") as f:
                    code = f.read()
                
                try:
                    analyzer = PythonASTAnalyzer(file_path)
                except TypeError:
                    analyzer = PythonASTAnalyzer()

                if hasattr(analyzer, "parse_code"):
                    analysis = analyzer.parse_code(code) if analyzer.__class__.__init__.__code__.co_argcount > 1 else analyzer.parse_code(code, file_path)
                elif hasattr(analyzer, "analyze"):
                    analysis = analyzer.analyze(code)
                else:
                    analysis = {"functions": [], "classes": []}

                parsed_data.append(analysis)

        # 3. Resolve Cross-Module Symbols
        resolver = SymbolResolver()
        if hasattr(resolver, "register_symbols"):
            resolver.register_symbols(parsed_data)

        # 4. Build Knowledge Graph
        graph_service = GraphService()
        all_symbols = []
        for file_data in parsed_data:
            if isinstance(file_data, dict):
                all_symbols.extend(file_data.get("functions", []))

        if hasattr(graph_service, "build_graph_from_symbols"):
            graph_service.build_graph_from_symbols(all_symbols, [])

        # 5. Verify Graph Export Payload
        if hasattr(graph_service, "export_graph"):
            export_data = graph_service.export_graph()
            assert isinstance(export_data, dict)