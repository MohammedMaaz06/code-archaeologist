from pathlib import Path
from typing import Any, Dict, List

from app.analyzers.js_analyzer import JSTSAnalyzer
from app.analyzers.python_analyzer import PythonASTAnalyzer
from app.services.graph_service import GraphService
from app.services.repo_scanner import RepoScanner
from app.services.symbol_resolver import SymbolResolver


SUPPORTED_ANALYSIS_LANGUAGES = {
    "python",
    "javascript",
    "typescript",
}


class RepositoryAnalysisService:
    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path).resolve()
        self.scanner = RepoScanner(str(self.repo_path))
        self.resolver = SymbolResolver()
        self.graph_service = GraphService()
        self.files = []
        self.files_analysis = []
        self.resolved_calls = []

    def analyze(self):
        self.files = self.scanner.scan()
        self.files_analysis = []

        for scanned_file in self.files:
            if scanned_file.language not in SUPPORTED_ANALYSIS_LANGUAGES:
                continue

            analysis = self._analyze_file(scanned_file)

            if analysis is not None:
                self._normalize_analysis_paths(
                    analysis,
                    scanned_file.relative_path,
                )
                self.files_analysis.append(analysis)

        self.resolver = SymbolResolver()
        self.resolver.register_symbols(self.files_analysis)

        self.resolved_calls = self._resolve_calls()

        symbols = self._flatten_symbols()

        self.graph_service.build_graph_from_symbols(
            symbols_data=symbols,
            resolved_calls=self.resolved_calls,
        )

        return {
            "repository": str(self.repo_path),
            "scanned_files": len(self.files),
            "analyzed_files": len(self.files_analysis),
            "symbols": len(symbols),
            "calls": len(self._all_calls()),
            "resolved_calls": len(self.resolved_calls),
            "graph_nodes": self.graph_service.graph.number_of_nodes(),
            "graph_edges": self.graph_service.graph.number_of_edges(),
            "analysis": self.files_analysis,
            "resolved_call_details": self.resolved_calls,
            "graph": self.graph_service.export_graph(),
        }

    def _analyze_file(self, scanned_file):
        file_path = scanned_file.full_path

        try:
            if scanned_file.language == "python":
                return PythonASTAnalyzer(file_path).analyze()

            if scanned_file.language in {
                "javascript",
                "typescript",
            }:
                return self._analyze_javascript(
                    file_path,
                    scanned_file,
                )

        except Exception:
            return None

        return None

    def _normalize_analysis_paths(
        self,
        analysis,
        relative_path,
    ):
        analysis["file_path"] = relative_path

        for collection_name in (
            "classes",
            "functions",
        ):
            for symbol in analysis.get(collection_name, []):
                symbol["file_path"] = relative_path

                symbol_name = symbol.get("symbol_name")

                if symbol_name:
                    symbol_id = f"{relative_path}:{symbol_name}"
                    symbol["symbol_id"] = symbol_id
                    symbol["full_symbol_id"] = symbol_id

        for call in analysis.get("calls", []):
            call["file_path"] = relative_path

            caller_symbol = call.get("caller_symbol")

            if caller_symbol:
                call["caller_symbol_id"] = (
                    f"{relative_path}:{caller_symbol}"
                )

    def _analyze_javascript(
        self,
        file_path,
        scanned_file,
    ):
        analyzer = JSTSAnalyzer(file_path)

        analysis = analyzer.analyze()

        analysis["file_path"] = str(file_path)
        analysis["relative_path"] = scanned_file.relative_path
        analysis["language"] = scanned_file.language

        return analysis

    def _resolve_calls(self):
        resolved = []

        for call in self._all_calls():
            caller_symbol_id = call.get("caller_symbol_id")
            caller_symbol = call.get("caller_symbol")
            target_name = call.get("target_name")

            if not caller_symbol_id or not target_name:
                continue

            caller_file = call.get("file_path")

            target_symbol = self.resolver.resolve_call(
                caller_file=caller_file,
                caller_symbol=caller_symbol,
                target_name=target_name,
            )

            if target_symbol:
                resolved.append({
                    **call,
                    "target_symbol_id": target_symbol.get("target_symbol_id"),
                })

        return resolved

    def _flatten_symbols(self):
        symbols = []

        for file_data in self.files_analysis:
            symbols.extend(
                file_data.get("classes", [])
            )
            symbols.extend(
                file_data.get("functions", [])
            )

        return symbols

    def _all_calls(self):
        calls = []

        for file_data in self.files_analysis:
            calls.extend(
                file_data.get("calls", [])
            )

        return calls

