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
    """
    Runs the complete static-analysis pipeline for a repository:

        Scanner
          -> Language analyzer
          -> Structured symbols
          -> Symbol resolver
          -> Knowledge graph
    """

    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path).resolve()
        self.scanner = RepoScanner(str(self.repo_path))
        self.resolver = SymbolResolver()
        self.graph_service = GraphService()

        self.files: List[Any] = []
        self.files_analysis: List[Dict[str, Any]] = []
        self.resolved_calls: List[Dict[str, Any]] = []

    def analyze(self) -> Dict[str, Any]:
        """Analyze the repository and build its knowledge graph."""
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

    def _analyze_file(self, scanned_file: Any) -> Dict[str, Any] | None:
        """Run the appropriate analyzer for one scanned source file."""
        file_path = scanned_file.full_path

        try:
            if scanned_file.language == "python":
                return PythonASTAnalyzer(file_path).analyze()

            if scanned_file.language in {"javascript", "typescript"}:
                return self._analyze_javascript(file_path, scanned_file)

        except Exception:
            return None

        return None

    def _normalize_analysis_paths(
        self,
        analysis: Dict[str, Any],
        relative_path: str,
    ) -> None:
        """
        Convert analyzer-generated absolute paths into repository-relative
        paths so graph IDs remain stable across machines and environments.
        """
        analysis["file_path"] = relative_path

        for collection_name in ("classes", "functions"):
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
        file_path: Path,
        scanned_file: Any,
    ) -> Dict[str, Any]:
        """
        Normalize the existing JS/TS extractor into the repository
        analysis schema.

        JS/TS call extraction will be added when the real JS/TS AST
        analyzer is implemented.
        """
        extracted = JSTSAnalyzer(file_path).extract_symbols()

        result: Dict[str, Any] = {
            "file_path": str(file_path),
            "relative_path": scanned_file.relative_path,
            "language": scanned_file.language,
            "imports": [],
            "classes": [],
            "functions": [],
            "calls": [],
        }

        for symbol in extracted:
            base = {
                "symbol_name": symbol.name,
                "short_name": symbol.name,
                "file_path": str(file_path),
                "start_line": symbol.start_line,
                "end_line": symbol.end_line,
                "signature": symbol.signature,
            }

            if symbol.kind == "class":
                result["classes"].append({
                    **base,
                    "symbol_type": "class",
                })

            elif symbol.kind in {"function", "method"}:
                result["functions"].append({
                    **base,
                    "symbol_type": symbol.kind,
                    "parent_symbol": symbol.parent_symbol,
                })

            elif symbol.kind == "import":
                result["imports"].append({
                    "module": symbol.name,
                    "imported_name": symbol.name,
                    "alias": None,
                    "start_line": symbol.start_line,
                    "end_line": symbol.end_line,
                })

        return result

    def _all_calls(self) -> List[Dict[str, Any]]:
        calls: List[Dict[str, Any]] = []

        for file_data in self.files_analysis:
            calls.extend(file_data.get("calls", []))

        return calls

    def _resolve_calls(self) -> List[Dict[str, Any]]:
        """Resolve every extracted call against the global symbol table."""
        resolved: List[Dict[str, Any]] = []

        for file_data in self.files_analysis:
            file_path = file_data.get("file_path", "")

            for call in file_data.get("calls", []):
                target_name = call.get("target_name")
                caller_symbol = call.get("caller_symbol")

                if not target_name or not caller_symbol:
                    continue

                resolution = self.resolver.resolve_call(
                    caller_file=file_path,
                    caller_symbol=caller_symbol,
                    target_name=target_name,
                )

                if resolution.get("resolved"):
                    resolved.append({
                        "caller_symbol_id": call.get(
                            "caller_symbol_id"
                        ) or f"{file_path}:{caller_symbol}",
                        "target_symbol_id": resolution.get(
                            "target_symbol_id"
                        ),
                        "target_name": target_name,
                        "resolution_type": resolution.get(
                            "resolution_type"
                        ),
                        "file_path": file_path,
                        "start_line": call.get("start_line"),
                        "end_line": call.get("end_line"),
                    })

        return resolved

    def _flatten_symbols(self) -> List[Dict[str, Any]]:
        """Convert analyzed classes/functions into graph symbols."""
        symbols: List[Dict[str, Any]] = []

        for file_data in self.files_analysis:
            for symbol in (
                file_data.get("classes", [])
                + file_data.get("functions", [])
            ):
                symbol_copy = dict(symbol)

                symbol_id = (
                    symbol_copy.get("full_symbol_id")
                    or symbol_copy.get("symbol_id")
                    or (
                        f"{symbol_copy.get('file_path', '')}:"
                        f"{symbol_copy.get('symbol_name', '')}"
                    )
                )

                symbol_copy["symbol_id"] = symbol_id
                symbols.append(symbol_copy)

        return symbols

    def get_graph(self) -> Dict[str, Any]:
        """Return the current repository knowledge graph."""
        return self.graph_service.export_graph()
